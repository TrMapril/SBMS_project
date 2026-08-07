import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { CreateWorkflowStateDto } from './dto/create-workflow-state.dto';
import { UpdateWorkflowStateDto } from './dto/update-workflow-state.dto';
import { CreateWorkflowTransitionDto } from './dto/create-workflow-transition.dto';
import { UpdateWorkflowTransitionDto } from './dto/update-workflow-transition.dto';
import { WorkflowCacheService } from './workflow-cache.service';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowCache: WorkflowCacheService,
  ) {}

  // ---------- Workflow ----------

  async createWorkflow(tenantId: string, dto: CreateWorkflowDto) {
    return this.prisma.workflow.create({
      data: { tenantId, name: dto.name },
    });
  }

  async findAllWorkflows(tenantId: string, pagination: PaginationQueryDto) {
    const { page, limit } = pagination;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.workflow.findMany({
        where: { tenantId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.workflow.count({ where: { tenantId } }),
    ]);
    return { data, total, page, limit };
  }

  async findOneWorkflow(tenantId: string, id: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, tenantId },
      include: {
        states: { orderBy: { orderIndex: 'asc' } },
        transitions: true,
      },
    });
    if (!workflow) {
      throw new NotFoundException('Không tìm thấy Workflow');
    }
    return workflow;
  }

  private async assertWorkflowInTenant(tenantId: string, id: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, tenantId },
    });
    if (!workflow) {
      throw new NotFoundException('Không tìm thấy Workflow');
    }
    return workflow;
  }

  async updateWorkflow(tenantId: string, id: string, dto: UpdateWorkflowDto) {
    await this.assertWorkflowInTenant(tenantId, id);
    return this.prisma.workflow.update({ where: { id }, data: dto });
  }

  async removeWorkflow(tenantId: string, id: string) {
    await this.assertWorkflowInTenant(tenantId, id);
    const taskCount = await this.prisma.task.count({
      where: { currentState: { workflowId: id } },
    });
    if (taskCount > 0) {
      throw new BadRequestException(
        'Không thể xoá Workflow đang có Task sử dụng, hãy set is_active = false',
      );
    }
    const projectCount = await this.prisma.project.count({
      where: { workflowId: id },
    });
    if (projectCount > 0) {
      throw new BadRequestException(
        'Không thể xoá Workflow đang được Project sử dụng, hãy set is_active = false',
      );
    }
    await this.prisma.workflow.delete({ where: { id } });
    await this.workflowCache.invalidate(id);
    return { id };
  }

  // ---------- Workflow State ----------

  /**
   * Task Board hiển thị cột theo `order_index`, nhưng Workflow Builder không có ô nhập thứ tự
   * riêng — người dùng "sắp xếp thứ tự flow" bằng cách kéo-thả vị trí trái→phải trên canvas.
   * Vì vậy mỗi khi 1 State được tạo/kéo tới vị trí mới, tính lại `order_index` cho TOÀN BỘ State
   * đang active của Workflow theo thứ tự `position_x` tăng dần, để Kanban luôn khớp đúng thứ tự
   * hình dung trên canvas. State chưa từng có toạ độ (null) xếp sau cùng, giữ nguyên thứ tự
   * tương đối theo `order_index` cũ giữa chúng với nhau.
   */
  private async resyncOrderIndexByPosition(workflowId: string) {
    const states = await this.prisma.workflowState.findMany({
      where: { workflowId, isActive: true },
      orderBy: { orderIndex: 'asc' },
    });
    const positioned = states
      .filter((s) => s.positionX != null)
      .sort((a, b) => a.positionX! - b.positionX!);
    const unpositioned = states.filter((s) => s.positionX == null);
    const ordered = [...positioned, ...unpositioned];

    const updates = ordered
      .map((s, targetIndex) => ({ id: s.id, targetIndex, currentIndex: s.orderIndex }))
      .filter((u) => u.targetIndex !== u.currentIndex);
    if (updates.length === 0) return;

    await this.prisma.$transaction(
      updates.map((u) =>
        this.prisma.workflowState.update({
          where: { id: u.id },
          data: { orderIndex: u.targetIndex },
        }),
      ),
    );
  }

  async createState(
    tenantId: string,
    workflowId: string,
    dto: CreateWorkflowStateDto,
  ) {
    await this.assertWorkflowInTenant(tenantId, workflowId);

    let created;
    if (dto.isStart) {
      created = await this.prisma.$transaction(async (tx) => {
        await tx.workflowState.updateMany({
          where: { workflowId, isStart: true },
          data: { isStart: false },
        });
        return tx.workflowState.create({
          data: {
            workflowId,
            name: dto.name,
            isStart: true,
            isEnd: dto.isEnd ?? false,
            orderIndex: dto.orderIndex ?? 0,
            positionX: dto.positionX,
            positionY: dto.positionY,
          },
        });
      });
    } else {
      created = await this.prisma.workflowState.create({
        data: {
          workflowId,
          name: dto.name,
          isEnd: dto.isEnd ?? false,
          orderIndex: dto.orderIndex ?? 0,
          positionX: dto.positionX,
          positionY: dto.positionY,
        },
      });
    }

    if (dto.positionX != null) {
      await this.resyncOrderIndexByPosition(workflowId);
      created = await this.prisma.workflowState.findUniqueOrThrow({
        where: { id: created.id },
      });
    }
    // Invalidate NGAY cache cấu trúc Workflow (Mục 3.8 CLAUDE.md) — không đợi TTL, để lần
    // transition tiếp theo của WorkflowEngineService thấy State mới ngay lập tức.
    await this.workflowCache.invalidate(workflowId);
    return created;
  }

  async findAllStates(tenantId: string, workflowId: string) {
    await this.assertWorkflowInTenant(tenantId, workflowId);
    return this.prisma.workflowState.findMany({
      where: { workflowId },
      orderBy: { orderIndex: 'asc' },
    });
  }

  private async assertStateInWorkflow(workflowId: string, stateId: string) {
    const state = await this.prisma.workflowState.findFirst({
      where: { id: stateId, workflowId },
    });
    if (!state) {
      throw new NotFoundException('Không tìm thấy State trong Workflow này');
    }
    return state;
  }

  async updateState(
    tenantId: string,
    workflowId: string,
    stateId: string,
    dto: UpdateWorkflowStateDto,
  ) {
    await this.assertWorkflowInTenant(tenantId, workflowId);
    await this.assertStateInWorkflow(workflowId, stateId);

    if (dto.isStart) {
      await this.prisma.$transaction(async (tx) => {
        await tx.workflowState.updateMany({
          where: { workflowId, isStart: true, id: { not: stateId } },
          data: { isStart: false },
        });
        await tx.workflowState.update({ where: { id: stateId }, data: dto });
      });
    } else {
      await this.prisma.workflowState.update({ where: { id: stateId }, data: dto });
    }

    if (dto.positionX != null) {
      await this.resyncOrderIndexByPosition(workflowId);
    }
    await this.workflowCache.invalidate(workflowId);
    return this.prisma.workflowState.findUniqueOrThrow({ where: { id: stateId } });
  }

  async removeState(tenantId: string, workflowId: string, stateId: string) {
    await this.assertWorkflowInTenant(tenantId, workflowId);
    await this.assertStateInWorkflow(workflowId, stateId);

    const taskCount = await this.prisma.task.count({
      where: { currentStateId: stateId },
    });
    if (taskCount > 0) {
      throw new BadRequestException(
        'Không thể xoá State đang có Task sử dụng, hãy set is_active = false',
      );
    }
    await this.prisma.workflowState.delete({ where: { id: stateId } });
    await this.workflowCache.invalidate(workflowId);
    return { id: stateId };
  }

  // ---------- Workflow Transition ----------

  async createTransition(
    tenantId: string,
    workflowId: string,
    dto: CreateWorkflowTransitionDto,
  ) {
    await this.assertWorkflowInTenant(tenantId, workflowId);
    await this.assertStateInWorkflow(workflowId, dto.fromStateId);
    await this.assertStateInWorkflow(workflowId, dto.toStateId);
    await this.assertRolesInTenant(tenantId, dto.allowRoles);

    const created = await this.prisma.workflowTransition.create({
      data: {
        workflowId,
        name: dto.name,
        fromStateId: dto.fromStateId,
        toStateId: dto.toStateId,
        allowRoles: dto.allowRoles ?? [],
        condition: dto.condition ? { ...dto.condition } : undefined,
      },
    });
    await this.workflowCache.invalidate(workflowId);
    return created;
  }

  async findAllTransitions(tenantId: string, workflowId: string) {
    await this.assertWorkflowInTenant(tenantId, workflowId);
    return this.prisma.workflowTransition.findMany({ where: { workflowId } });
  }

  private async assertTransitionInWorkflow(
    workflowId: string,
    transitionId: string,
  ) {
    const transition = await this.prisma.workflowTransition.findFirst({
      where: { id: transitionId, workflowId },
    });
    if (!transition) {
      throw new NotFoundException(
        'Không tìm thấy Transition trong Workflow này',
      );
    }
    return transition;
  }

  private async assertRolesInTenant(tenantId: string, roleIds?: string[]) {
    if (!roleIds || roleIds.length === 0) return;
    const count = await this.prisma.role.count({
      where: { id: { in: roleIds }, tenantId },
    });
    if (count !== roleIds.length) {
      throw new BadRequestException(
        'allowRoles chứa Custom Role không thuộc tenant',
      );
    }
  }

  async updateTransition(
    tenantId: string,
    workflowId: string,
    transitionId: string,
    dto: UpdateWorkflowTransitionDto,
  ) {
    await this.assertWorkflowInTenant(tenantId, workflowId);
    await this.assertTransitionInWorkflow(workflowId, transitionId);
    if (dto.fromStateId) {
      await this.assertStateInWorkflow(workflowId, dto.fromStateId);
    }
    if (dto.toStateId) {
      await this.assertStateInWorkflow(workflowId, dto.toStateId);
    }
    await this.assertRolesInTenant(tenantId, dto.allowRoles);

    // Phân biệt rõ 3 trường hợp của `condition`: không gửi field này (undefined — giữ nguyên giá
    // trị cũ), gửi "condition": null (Prisma.JsonNull — XOÁ condition cũ), hoặc gửi 1 object mới
    // (ghi đè). Trước đây coi cả undefined lẫn null là "undefined" nên không thể xoá condition
    // đã có qua PATCH — bug phát hiện khi test cache Giai đoạn 6, xem DECISIONS.md #21.
    let conditionUpdate: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined;
    if (dto.condition === undefined) {
      conditionUpdate = undefined;
    } else if (dto.condition === null) {
      conditionUpdate = Prisma.JsonNull;
    } else {
      conditionUpdate = { ...dto.condition };
    }

    const updated = await this.prisma.workflowTransition.update({
      where: { id: transitionId },
      data: {
        ...dto,
        condition: conditionUpdate,
      },
    });
    await this.workflowCache.invalidate(workflowId);
    return updated;
  }

  async removeTransition(
    tenantId: string,
    workflowId: string,
    transitionId: string,
  ) {
    await this.assertWorkflowInTenant(tenantId, workflowId);
    await this.assertTransitionInWorkflow(workflowId, transitionId);

    const usedCount = await this.prisma.taskHistory.count({
      where: { transitionId },
    });
    if (usedCount > 0) {
      throw new BadRequestException(
        'Không thể xoá Transition đã từng được sử dụng, hãy set is_active = false',
      );
    }
    await this.prisma.workflowTransition.delete({
      where: { id: transitionId },
    });
    await this.workflowCache.invalidate(workflowId);
    return { id: transitionId };
  }
}

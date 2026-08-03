import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { CreateWorkflowStateDto } from './dto/create-workflow-state.dto';
import { UpdateWorkflowStateDto } from './dto/update-workflow-state.dto';
import { CreateWorkflowTransitionDto } from './dto/create-workflow-transition.dto';
import { UpdateWorkflowTransitionDto } from './dto/update-workflow-transition.dto';

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

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
    await this.prisma.workflow.delete({ where: { id } });
    return { id };
  }

  // ---------- Workflow State ----------

  async createState(
    tenantId: string,
    workflowId: string,
    dto: CreateWorkflowStateDto,
  ) {
    await this.assertWorkflowInTenant(tenantId, workflowId);

    if (dto.isStart) {
      return this.prisma.$transaction(async (tx) => {
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
          },
        });
      });
    }

    return this.prisma.workflowState.create({
      data: {
        workflowId,
        name: dto.name,
        isEnd: dto.isEnd ?? false,
        orderIndex: dto.orderIndex ?? 0,
      },
    });
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
      return this.prisma.$transaction(async (tx) => {
        await tx.workflowState.updateMany({
          where: { workflowId, isStart: true, id: { not: stateId } },
          data: { isStart: false },
        });
        return tx.workflowState.update({ where: { id: stateId }, data: dto });
      });
    }

    return this.prisma.workflowState.update({
      where: { id: stateId },
      data: dto,
    });
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

    return this.prisma.workflowTransition.create({
      data: {
        workflowId,
        name: dto.name,
        fromStateId: dto.fromStateId,
        toStateId: dto.toStateId,
        allowRoles: dto.allowRoles ?? [],
        condition: dto.condition ? { ...dto.condition } : undefined,
      },
    });
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

    return this.prisma.workflowTransition.update({
      where: { id: transitionId },
      data: {
        ...dto,
        condition: dto.condition ? { ...dto.condition } : undefined,
      },
    });
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
    return { id: transitionId };
  }
}

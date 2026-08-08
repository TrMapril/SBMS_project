import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { WorkflowEngineService } from '../workflow/workflow-engine.service';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import { ProjectsService } from '../projects/projects.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TransitionTaskDto } from './dto/transition-task.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { AssignCustomFieldValuesDto } from './dto/assign-custom-field-values.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import type { JwtPayload } from '../common/types/jwt-payload.type';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly customFieldsService: CustomFieldsService,
    private readonly projectsService: ProjectsService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(tenantId: string, dto: CreateTaskDto) {
    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, tenantId },
    });
    if (!project) {
      throw new NotFoundException('Không tìm thấy Project trong tenant');
    }

    const startState = await this.prisma.workflowState.findFirst({
      where: { workflowId: project.workflowId, isStart: true, isActive: true },
    });
    if (!startState) {
      throw new BadRequestException(
        'Workflow của Project chưa có State bắt đầu (is_start)',
      );
    }

    if (dto.assigneeId) {
      const assignee = await this.prisma.user.findFirst({
        where: { id: dto.assigneeId, tenantId },
      });
      if (!assignee) {
        throw new NotFoundException('Không tìm thấy assignee trong tenant');
      }
    }

    const normalizedValues = dto.customFieldValues
      ? await this.customFieldsService.validateAndNormalizeValues(
          tenantId,
          dto.customFieldValues,
        )
      : [];

    const created = await this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          tenantId,
          projectId: dto.projectId,
          title: dto.title,
          description: dto.description,
          currentStateId: startState.id,
          assigneeId: dto.assigneeId,
          priority: dto.priority,
          deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        },
      });

      if (normalizedValues.length > 0) {
        await tx.customFieldValue.createMany({
          data: normalizedValues.map((v) => ({
            taskId: task.id,
            customFieldId: v.customFieldId,
            value: v.value,
          })),
        });
      }

      return tx.task.findUniqueOrThrow({
        where: { id: task.id },
        include: { customFieldValues: true },
      });
    });

    await this.notifyTaskAssigned(tenantId, created);
    return created;
  }

  /** Tách riêng khỏi `create()` — notification gọi Socket.io/DB riêng, không cần nằm trong
   * transaction tạo Task (transaction rollback không nên phụ thuộc việc gửi notification). */
  private async notifyTaskAssigned(
    tenantId: string,
    task: { id: string; title: string; assigneeId: string | null },
  ) {
    if (!task.assigneeId) return;
    await this.notifications.notify(tenantId, task.assigneeId, 'task:assigned', {
      taskId: task.id,
      taskTitle: task.title,
    });
  }

  async findAll(tenantId: string, query: ListTasksQueryDto, requester: JwtPayload) {
    const { page, limit, projectId } = query;
    // Employee chỉ được xem Task của Project mình là thành viên/có Task được giao — không giới
    // hạn khi liệt kê KHÔNG kèm projectId vì trường hợp đó chưa xảy ra ở Task Board (luôn lọc
    // theo 1 project cụ thể), giữ đúng phạm vi lỗ hổng đã phát hiện.
    if (projectId) {
      await this.projectsService.assertEmployeeCanAccessProject(projectId, requester);
    }
    const where = { tenantId, ...(projectId ? { projectId } : {}) };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.task.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, tenantId },
      include: {
        currentState: true,
        history: { orderBy: { actionAt: 'desc' } },
        customFieldValues: true,
      },
    });
    if (!task) {
      throw new NotFoundException('Không tìm thấy Task');
    }
    return task;
  }

  async assignCustomFieldValues(
    tenantId: string,
    taskId: string,
    dto: AssignCustomFieldValuesDto,
  ) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, tenantId },
    });
    if (!task) {
      throw new NotFoundException('Không tìm thấy Task');
    }

    const normalizedValues =
      await this.customFieldsService.validateAndNormalizeValues(
        tenantId,
        dto.values,
      );

    await this.prisma.$transaction(
      normalizedValues.map((v) =>
        this.prisma.customFieldValue.upsert({
          where: {
            taskId_customFieldId: { taskId, customFieldId: v.customFieldId },
          },
          create: { taskId, customFieldId: v.customFieldId, value: v.value },
          update: { value: v.value },
        }),
      ),
    );

    return this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      include: { customFieldValues: true },
    });
  }

  async transition(
    tenantId: string,
    taskId: string,
    userId: string,
    dto: TransitionTaskDto,
  ) {
    // Phase 7.5 Đợt 1 mục B — Task đã khoá (completed_at) thì KHÔNG được đi qua
    // WorkflowEngineService nữa, chặn ngay tại đây (đúng "không cho qua WorkflowEngineService"
    // trong phase_7_5.md — đây là ràng buộc Task-level, không phải logic Workflow Engine).
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, tenantId },
      select: { completedAt: true },
    });
    if (!task) {
      throw new NotFoundException('Không tìm thấy Task');
    }
    if (task.completedAt) {
      throw new BadRequestException(
        'Task đã hoàn thành và bị khoá, không thể chuyển trạng thái',
      );
    }

    return this.workflowEngine.transition({
      tenantId,
      taskId,
      userId,
      transitionId: dto.transitionId,
      expectedVersion: dto.version,
      comment: dto.comment,
    });
  }

  /** Phase 7.5 Đợt 1 mục B — assignee bấm "Report Done" khi Task đang ở State is_end=true. KHÔNG
   * phải transition Workflow Engine (Mục 3.1 CLAUDE.md — không hard-code state name), chỉ là 1
   * cờ Task-level áp dụng cho BẤT KỲ State nào có is_end=true. */
  async reportDone(tenantId: string, taskId: string, userId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, tenantId },
      include: { currentState: { select: { isEnd: true } } },
    });
    if (!task) {
      throw new NotFoundException('Không tìm thấy Task');
    }
    if (task.assigneeId !== userId) {
      throw new ForbiddenException('Chỉ assignee của Task mới được Report Done');
    }
    if (task.completedAt) {
      throw new BadRequestException('Task đã hoàn thành và bị khoá');
    }
    if (!task.currentState.isEnd) {
      throw new BadRequestException(
        'Task chưa ở trạng thái kết thúc (is_end), không thể Report Done',
      );
    }
    if (task.pendingDoneConfirmation) {
      throw new BadRequestException(
        'Task đã được Report Done, đang chờ Manager xác nhận',
      );
    }
    return this.prisma.task.update({
      where: { id: taskId },
      data: { pendingDoneConfirmation: true },
    });
  }

  /** Phase 7.5 Đợt 1 mục B — Manager "Xác nhận Done": khoá Task vĩnh viễn (completedAt), sau đó
   * kiểm tra xem Project có nên tự chuyển COMPLETED không (mục A). */
  async confirmDone(tenantId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, tenantId } });
    if (!task) {
      throw new NotFoundException('Không tìm thấy Task');
    }
    if (!task.pendingDoneConfirmation) {
      throw new BadRequestException(
        'Task chưa được assignee Report Done, không thể xác nhận',
      );
    }
    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { completedAt: new Date(), pendingDoneConfirmation: false },
    });
    await this.projectsService.maybeCompleteProject(task.projectId);
    return updated;
  }
}

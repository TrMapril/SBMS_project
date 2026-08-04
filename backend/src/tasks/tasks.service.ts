import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { WorkflowEngineService } from '../workflow/workflow-engine.service';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import { TransitionTaskDto } from './dto/transition-task.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { AssignCustomFieldValuesDto } from './dto/assign-custom-field-values.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly customFieldsService: CustomFieldsService,
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

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          tenantId,
          projectId: dto.projectId,
          title: dto.title,
          description: dto.description,
          currentStateId: startState.id,
          assigneeId: dto.assigneeId,
          priority: dto.priority,
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
  }

  async findAll(tenantId: string, pagination: PaginationQueryDto) {
    const { page, limit } = pagination;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where: { tenantId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.task.count({ where: { tenantId } }),
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
    return this.workflowEngine.transition({
      tenantId,
      taskId,
      userId,
      transitionId: dto.transitionId,
      expectedVersion: dto.version,
      comment: dto.comment,
    });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { WorkflowEngineService } from '../workflow/workflow-engine.service';
import { TransitionTaskDto } from './dto/transition-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEngine: WorkflowEngineService,
  ) {}

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
      },
    });
    if (!task) {
      throw new NotFoundException('Không tìm thấy Task');
    }
    return task;
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

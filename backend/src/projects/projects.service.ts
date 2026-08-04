import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertWorkflowInTenant(tenantId: string, workflowId: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id: workflowId, tenantId },
    });
    if (!workflow) {
      throw new NotFoundException('Không tìm thấy Workflow trong tenant');
    }
    return workflow;
  }

  async create(tenantId: string, dto: CreateProjectDto) {
    await this.assertWorkflowInTenant(tenantId, dto.workflowId);
    return this.prisma.project.create({
      data: { tenantId, name: dto.name, workflowId: dto.workflowId },
    });
  }

  async findAll(tenantId: string, pagination: PaginationQueryDto) {
    const { page, limit } = pagination;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where: { tenantId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.project.count({ where: { tenantId } }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, tenantId },
      include: { members: true },
    });
    if (!project) {
      throw new NotFoundException('Không tìm thấy Project');
    }
    return project;
  }

  async update(tenantId: string, id: string, dto: UpdateProjectDto) {
    const project = await this.findOne(tenantId, id);

    if (dto.workflowId && dto.workflowId !== project.workflowId) {
      await this.assertWorkflowInTenant(tenantId, dto.workflowId);
      const taskCount = await this.prisma.task.count({
        where: { projectId: id },
      });
      if (taskCount > 0) {
        throw new BadRequestException(
          'Không thể đổi Workflow của Project đang có Task',
        );
      }
    }

    return this.prisma.project.update({
      where: { id },
      data: { name: dto.name, workflowId: dto.workflowId },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    const taskCount = await this.prisma.task.count({
      where: { projectId: id },
    });
    if (taskCount > 0) {
      throw new BadRequestException(
        'Không thể xoá Project đang có Task, hãy xoá/chuyển Task trước',
      );
    }
    await this.prisma.project.delete({ where: { id } });
    return { id };
  }

  async addMember(
    tenantId: string,
    projectId: string,
    dto: AddProjectMemberDto,
  ) {
    await this.findOne(tenantId, projectId);
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, tenantId },
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy user trong tenant');
    }

    try {
      return await this.prisma.projectMember.create({
        data: { projectId, userId: dto.userId },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('User đã là thành viên của Project này');
      }
      throw error;
    }
  }

  async listMembers(tenantId: string, projectId: string) {
    await this.findOne(tenantId, projectId);
    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            systemRole: true,
            status: true,
          },
        },
      },
    });
  }

  async removeMember(tenantId: string, projectId: string, userId: string) {
    await this.findOne(tenantId, projectId);
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!member) {
      throw new NotFoundException('User chưa là thành viên của Project này');
    }
    await this.prisma.projectMember.delete({ where: { id: member.id } });
    return { id: member.id };
  }
}

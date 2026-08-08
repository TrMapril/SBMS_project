import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProjectStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import type { JwtPayload } from '../common/types/jwt-payload.type';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Employee chỉ được xem Project mà họ là project_member HOẶC đang có Task được giao trong đó
   * — Admin/Manager xem toàn bộ Project trong tenant, không bị chặn ở đây. Dùng chung cho
   * ProjectsService (GET :id, :id/members) và TasksService (GET ?projectId=...) — TasksModule
   * inject ProjectsService để gọi lại đúng 1 chỗ, không lặp logic ở 2 service.
   */
  async assertEmployeeCanAccessProject(projectId: string, requester: JwtPayload) {
    if (requester.systemRole !== 'EMPLOYEE') return;
    const isMember = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: requester.userId } },
    });
    if (isMember) return;
    const taskCount = await this.prisma.task.count({
      where: { projectId, assigneeId: requester.userId },
    });
    if (taskCount > 0) return;
    throw new ForbiddenException(
      'Bạn không phải thành viên và không có Task nào trong Project này',
    );
  }

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

  /** Phase 7.5 Đợt 2 — trang Quản lý dự án Admin (read-only) cần workflow/số thành viên/số Task/%
   * hoàn thành ngay trên bảng liệt kê, không phải mở từng project mới thấy (khác `findOne` vốn
   * chỉ 1 project). */
  async findAll(tenantId: string, pagination: PaginationQueryDto) {
    const { page, limit } = pagination;
    const [projects, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where: { tenantId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          workflow: { select: { id: true, name: true } },
          _count: { select: { members: true, tasks: true } },
        },
      }),
      this.prisma.project.count({ where: { tenantId } }),
    ]);

    const completedCounts = await this.prisma.task.groupBy({
      by: ['projectId'],
      where: { projectId: { in: projects.map((p) => p.id) }, completedAt: { not: null } },
      _count: { _all: true },
    });
    const completedByProject = new Map(completedCounts.map((c) => [c.projectId, c._count._all]));

    const data = projects.map(({ _count, ...p }) => {
      const totalTasks = _count.tasks;
      const completedTasks = completedByProject.get(p.id) ?? 0;
      return {
        ...p,
        memberCount: _count.members,
        totalTasks,
        completedTasks,
        completionPercent: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      };
    });
    return { data, total, page, limit };
  }

  /**
   * `requester` chỉ truyền khi gọi từ endpoint GET công khai cho mọi role (để enforce quyền
   * Employee) — các chỗ gọi nội bộ khác (update/remove/addMember/...) đều đã bị chặn Manager-only
   * ở Controller nên không cần kiểm tra thêm, bỏ qua tham số này (Employee không bao giờ tới
   * được các nhánh đó).
   */
  async findOne(tenantId: string, id: string, requester?: JwtPayload) {
    const project = await this.prisma.project.findFirst({
      where: { id, tenantId },
      include: {
        members: {
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
        },
      },
    });
    if (!project) {
      throw new NotFoundException('Không tìm thấy Project');
    }
    if (requester) {
      await this.assertEmployeeCanAccessProject(id, requester);
    }
    const stats = await this.getCompletionStats(id);
    return { ...project, ...stats };
  }

  /** Phase 7.5 Đợt 1 mục B — % hoàn thành = (Task đã khoá completed_at) / (tổng Task) × 100. */
  async getCompletionStats(projectId: string) {
    const [totalTasks, completedTasks] = await Promise.all([
      this.prisma.task.count({ where: { projectId } }),
      this.prisma.task.count({ where: { projectId, completedAt: { not: null } } }),
    ]);
    return {
      totalTasks,
      completedTasks,
      completionPercent: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    };
  }

  /** Phase 7.5 Đợt 1 mục A — gọi sau mỗi lần 1 Task bị khoá (Manager "Xác nhận Done", xem
   * TasksService.confirmDone). Chỉ tự chuyển COMPLETED khi project đang ACTIVE và có ít nhất 1
   * Task (project 0 Task không tự hoàn thành). Không đụng CANCELLED/COMPLETED đã có sẵn. */
  async maybeCompleteProject(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.status !== 'ACTIVE') return;
    const { totalTasks, completedTasks } = await this.getCompletionStats(projectId);
    if (totalTasks > 0 && totalTasks === completedTasks) {
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'COMPLETED' },
      });
    }
  }

  /** Phase 7.5 Đợt 1 mục A — Manager huỷ 1 project đang chạy. */
  async cancel(tenantId: string, id: string) {
    const project = await this.assertProjectStatusIn(tenantId, id, ['ACTIVE']);
    return this.prisma.project.update({
      where: { id: project.id },
      data: { status: 'CANCELLED' },
    });
  }

  /** Phase 7.5 Đợt 1 mục A — chặn restart nếu Workflow gắn với project đã bị Admin vô hiệu hoá. */
  async restart(tenantId: string, id: string) {
    const project = await this.assertProjectStatusIn(tenantId, id, ['CANCELLED']);
    const workflow = await this.prisma.workflow.findUniqueOrThrow({
      where: { id: project.workflowId },
    });
    if (!workflow.isActive) {
      throw new BadRequestException(
        'Không thể khởi động lại Project vì Workflow đang gắn đã bị vô hiệu hoá',
      );
    }
    return this.prisma.project.update({
      where: { id: project.id },
      data: { status: 'ACTIVE' },
    });
  }

  private async assertProjectStatusIn(
    tenantId: string,
    id: string,
    allowed: ProjectStatus[],
  ) {
    const project = await this.prisma.project.findFirst({ where: { id, tenantId } });
    if (!project) {
      throw new NotFoundException('Không tìm thấy Project');
    }
    if (!allowed.includes(project.status)) {
      throw new BadRequestException(
        `Project đang ở trạng thái ${project.status}, không thể thực hiện hành động này`,
      );
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

  async listMembers(tenantId: string, projectId: string, requester?: JwtPayload) {
    await this.findOne(tenantId, projectId, requester);
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

  /** Phase 7.5 Đợt 1 mục C — chỉ xoá được nếu chưa từng có Task nào ĐANG giao cho họ trong
   * project này (kiểm tra tasks.assignee_id + project_id đúng theo phase_7_5.md, không tra
   * task_history) — nếu có, chỉ cho phép tạm dừng (pauseMember), không xoá được. */
  async removeMember(tenantId: string, projectId: string, userId: string) {
    await this.findOne(tenantId, projectId);
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!member) {
      throw new NotFoundException('User chưa là thành viên của Project này');
    }
    const assignedTaskCount = await this.prisma.task.count({
      where: { projectId, assigneeId: userId },
    });
    if (assignedTaskCount > 0) {
      throw new BadRequestException(
        'User đang có Task được giao trong Project này — chỉ có thể tạm dừng, không xoá được',
      );
    }
    await this.prisma.projectMember.delete({ where: { id: member.id } });
    return { id: member.id };
  }

  async pauseMember(tenantId: string, projectId: string, userId: string) {
    return this.setMemberStatus(tenantId, projectId, userId, 'PAUSED');
  }

  async resumeMember(tenantId: string, projectId: string, userId: string) {
    return this.setMemberStatus(tenantId, projectId, userId, 'ACTIVE');
  }

  private async setMemberStatus(
    tenantId: string,
    projectId: string,
    userId: string,
    status: 'ACTIVE' | 'PAUSED',
  ) {
    await this.findOne(tenantId, projectId);
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!member) {
      throw new NotFoundException('User chưa là thành viên của Project này');
    }
    return this.prisma.projectMember.update({
      where: { id: member.id },
      data: { status },
    });
  }
}

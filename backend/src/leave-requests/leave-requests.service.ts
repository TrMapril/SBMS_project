import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { SupabaseStorageService } from '../common/storage/supabase-storage.service';
import { assertValidUpload } from '../common/utils/file-validation.util';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestTypesService } from '../request-types/request-types.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { ResolveLeaveRequestDto } from './dto/resolve-leave-request.dto';
import { ListLeaveRequestsQueryDto } from './dto/list-leave-requests-query.dto';
import type { JwtPayload } from '../common/types/jwt-payload.type';

const ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

/**
 * Module `leave_requests` (Giai đoạn 7), mở rộng thêm loại `TASK_RETURN` ở Phase 7.5 Đợt 1 mục
 * D. Từ Phase 7.5: CHỈ Manager duyệt được (thu hẹp so với DECISIONS.md #25 vốn cho cả Admin) —
 * Admin vẫn gửi đơn được như Employee nhưng không còn thấy/duyệt đơn của người khác. Không có
 * khái niệm "quản lý trực tiếp" (User không có managerId) — Manager DUY NHẤT của tenant (ràng
 * buộc "1 tenant 1 Manager" ở Phase 7.5) xem/duyệt được mọi đơn.
 */
@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: SupabaseStorageService,
    private readonly notifications: NotificationsService,
    private readonly requestTypes: RequestTypesService,
  ) {}

  async create(
    tenantId: string,
    userId: string,
    dto: CreateLeaveRequestDto,
    file?: Express.Multer.File,
  ) {
    const type = dto.type ?? 'LEAVE';

    if (type === 'TASK_RETURN') {
      return this.createTaskReturn(tenantId, userId, dto);
    }
    if (type === 'CUSTOM') {
      return this.createCustom(tenantId, userId, dto);
    }

    if (!dto.startDate || !dto.endDate) {
      throw new BadRequestException('Đơn nghỉ phép cần đủ startDate và endDate');
    }
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu');
    }

    let attachmentUrl: string | undefined;
    if (file) {
      assertValidUpload(file, ATTACHMENT_MIME_TYPES);
      attachmentUrl = await this.storage.upload(
        `leave-request-attachments/${tenantId}`,
        file,
      );
    }

    return this.prisma.leaveRequest.create({
      data: {
        tenantId,
        userId,
        type: 'LEAVE',
        startDate,
        endDate,
        reason: dto.reason,
        attachmentUrl,
      },
    });
  }

  /** Phase 7.5 Đợt 1 mục D — Employee "trả task" đang giao cho mình kèm lý do. */
  private async createTaskReturn(
    tenantId: string,
    userId: string,
    dto: CreateLeaveRequestDto,
  ) {
    if (!dto.taskId) {
      throw new BadRequestException('Đơn trả task cần taskId');
    }
    const task = await this.prisma.task.findFirst({
      where: { id: dto.taskId, tenantId },
    });
    if (!task) {
      throw new NotFoundException('Không tìm thấy Task trong tenant');
    }
    if (task.assigneeId !== userId) {
      throw new ForbiddenException('Chỉ assignee hiện tại của Task mới được trả task');
    }
    if (task.completedAt) {
      throw new BadRequestException('Task đã hoàn thành và bị khoá, không thể trả task');
    }
    const existingPending = await this.prisma.leaveRequest.findFirst({
      where: { taskId: task.id, type: 'TASK_RETURN', status: 'PENDING' },
    });
    if (existingPending) {
      throw new BadRequestException('Task này đã có đơn trả task đang chờ xử lý');
    }

    return this.prisma.leaveRequest.create({
      data: {
        tenantId,
        userId,
        type: 'TASK_RETURN',
        taskId: task.id,
        reason: dto.reason,
      },
    });
  }

  /** Phase 7.5 Đợt 2 — Employee/Admin gửi đơn theo 1 "loại đơn mẫu" do Admin tự định nghĩa. */
  private async createCustom(
    tenantId: string,
    userId: string,
    dto: CreateLeaveRequestDto,
  ) {
    if (!dto.requestTypeId) {
      throw new BadRequestException('Đơn theo loại mẫu cần requestTypeId');
    }
    const template = await this.requestTypes.findOne(tenantId, dto.requestTypeId);
    const fields = (template.fields as { key: string; label: string; required: boolean }[]) ?? [];
    const customFieldValues = this.requestTypes.validateCustomFieldValues(
      fields,
      dto.customFieldValues,
    );

    return this.prisma.leaveRequest.create({
      data: {
        tenantId,
        userId,
        type: 'CUSTOM',
        requestTypeId: template.id,
        reason: dto.reason,
        customFieldValues,
      },
    });
  }

  async findAll(
    tenantId: string,
    requester: JwtPayload,
    query: ListLeaveRequestsQueryDto,
  ) {
    const { page, limit, status, type } = query;
    // Phase 7.5 Đợt 2 — Admin xem được TOÀN BỘ đơn (view-only, không duyệt được — resolve/reset
    // vẫn chỉ Manager qua @Roles ở Controller). Manager giữ nguyên xem toàn bộ để duyệt.
    const canViewAll = requester.systemRole === 'MANAGER' || requester.systemRole === 'ADMIN';
    const where = {
      tenantId,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(canViewAll ? {} : { userId: requester.userId }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.leaveRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, fullName: true, email: true } },
          reviewer: { select: { id: true, fullName: true } },
          task: { select: { id: true, title: true } },
          requestType: { select: { id: true, name: true, fields: true } },
        },
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string, requester: JwtPayload) {
    const leaveRequest = await this.prisma.leaveRequest.findFirst({
      where: { id, tenantId },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        reviewer: { select: { id: true, fullName: true } },
        task: { select: { id: true, title: true } },
        requestType: { select: { id: true, name: true, fields: true } },
      },
    });
    if (!leaveRequest) {
      throw new NotFoundException('Không tìm thấy đơn từ');
    }
    const canViewAll = requester.systemRole === 'MANAGER' || requester.systemRole === 'ADMIN';
    if (!canViewAll && leaveRequest.userId !== requester.userId) {
      throw new ForbiddenException('Không có quyền xem đơn từ này');
    }
    return leaveRequest;
  }

  async resolve(
    tenantId: string,
    id: string,
    reviewerId: string,
    dto: ResolveLeaveRequestDto,
  ) {
    const leaveRequest = await this.prisma.leaveRequest.findFirst({
      where: { id, tenantId },
    });
    if (!leaveRequest) {
      throw new NotFoundException('Không tìm thấy đơn từ');
    }
    if (leaveRequest.status !== 'PENDING') {
      throw new BadRequestException('Đơn từ này đã được xử lý trước đó');
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: dto.status,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewComment: dto.comment ?? null,
      },
    });

    await this.notifications.notify(tenantId, leaveRequest.userId, 'leave-request:resolved', {
      leaveRequestId: leaveRequest.id,
      type: leaveRequest.type,
      status: dto.status,
      comment: dto.comment ?? null,
    });

    return updated;
  }

  /**
   * Phase 7.5 Đợt 1 mục D — sau khi đơn TASK_RETURN đã được duyệt (phù hợp hoặc không phù hợp),
   * Manager bấm "Reset": Task về đúng State is_start của Workflow, bỏ assignee, version tăng
   * theo optimistic locking hiện có, ghi task_history đầy đủ (Mục 3.11 CLAUDE.md — không có
   * ngoại lệ, kể cả hành động admin-override này). `taskResetAt` chặn reset lặp lại 2 lần cho
   * cùng 1 đơn.
   */
  async resetTask(tenantId: string, id: string, managerId: string) {
    const leaveRequest = await this.prisma.leaveRequest.findFirst({
      where: { id, tenantId },
    });
    if (!leaveRequest) {
      throw new NotFoundException('Không tìm thấy đơn từ');
    }
    if (leaveRequest.type !== 'TASK_RETURN' || !leaveRequest.taskId) {
      throw new BadRequestException('Chỉ đơn trả task mới có hành động Reset');
    }
    if (leaveRequest.status === 'PENDING') {
      throw new BadRequestException('Đơn này chưa được duyệt, chưa thể Reset Task');
    }
    if (leaveRequest.taskResetAt) {
      throw new BadRequestException('Task này đã được Reset trước đó');
    }

    const task = await this.prisma.task.findUniqueOrThrow({
      where: { id: leaveRequest.taskId },
      include: { currentState: { select: { workflowId: true } } },
    });
    if (task.completedAt) {
      throw new BadRequestException('Task đã hoàn thành và bị khoá, không thể Reset');
    }
    const startState = await this.prisma.workflowState.findFirst({
      where: { workflowId: task.currentState.workflowId, isStart: true, isActive: true },
    });
    if (!startState) {
      throw new BadRequestException('Workflow của Task chưa có State bắt đầu (is_start)');
    }

    await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.task.updateMany({
        where: { id: task.id, version: task.version },
        data: { currentStateId: startState.id, assigneeId: null, version: { increment: 1 } },
      });
      if (updateResult.count === 0) {
        throw new BadRequestException('Task đã bị thay đổi bởi thao tác khác, thử lại');
      }
      await tx.taskHistory.create({
        data: {
          taskId: task.id,
          fromStateId: task.currentStateId,
          toStateId: startState.id,
          transitionId: null,
          actionBy: managerId,
          comment: 'Reset sau khi duyệt đơn trả task',
        },
      });
      await tx.leaveRequest.update({
        where: { id: leaveRequest.id },
        data: { taskResetAt: new Date() },
      });
    });

    return this.prisma.task.findUniqueOrThrow({ where: { id: task.id } });
  }
}

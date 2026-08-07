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

const REVIEW_ROLES: JwtPayload['systemRole'][] = ['MANAGER', 'ADMIN'];

/**
 * Module `leave_requests` (Mục "Phạm vi" Giai đoạn 7 plan.md): Employee gửi đơn kèm file tuỳ
 * chọn, Manager/Admin duyệt/từ chối. User không có quan hệ "quản lý trực tiếp" (không có
 * `managerId`) trong data model hiện tại — MỌI Manager/Admin trong tenant đều xem và duyệt được
 * mọi đơn, giả định đơn giản nhất phù hợp Mục 8 CLAUDE.md, ghi rõ trong DECISIONS.md.
 */
@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: SupabaseStorageService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    tenantId: string,
    userId: string,
    dto: CreateLeaveRequestDto,
    file?: Express.Multer.File,
  ) {
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
      data: { tenantId, userId, startDate, endDate, reason: dto.reason, attachmentUrl },
    });
  }

  async findAll(
    tenantId: string,
    requester: JwtPayload,
    query: ListLeaveRequestsQueryDto,
  ) {
    const { page, limit, status } = query;
    const canReviewAll = REVIEW_ROLES.includes(requester.systemRole);
    const where = {
      tenantId,
      ...(status ? { status } : {}),
      ...(canReviewAll ? {} : { userId: requester.userId }),
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
      },
    });
    if (!leaveRequest) {
      throw new NotFoundException('Không tìm thấy đơn từ');
    }
    const canReviewAll = REVIEW_ROLES.includes(requester.systemRole);
    if (!canReviewAll && leaveRequest.userId !== requester.userId) {
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
      status: dto.status,
      comment: dto.comment ?? null,
    });

    return updated;
  }
}

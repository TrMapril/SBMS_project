import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationEventType } from './types/notification-payload.type';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  /**
   * Ghi DB trước rồi mới phát realtime — đúng thứ tự để đảm bảo "tắt mạng rồi mở lại vẫn thấy
   * notification bị lỡ" (DoD Giai đoạn 6): nếu phát trước rồi ghi DB lỗi, user online sẽ nhận
   * được nhưng user offline load lại sẽ không thấy gì. Emit không có người nhận (room rỗng) thì
   * Socket.io tự bỏ qua, không throw.
   */
  async notify(
    tenantId: string,
    userId: string,
    type: NotificationEventType,
    data: Prisma.InputJsonObject,
  ) {
    const notification = await this.prisma.notification.create({
      data: { tenantId, userId, type, data },
    });
    this.gateway.emitToUser(tenantId, userId, {
      type,
      data,
      timestamp: notification.createdAt.toISOString(),
    });
    return notification;
  }

  async findMine(
    tenantId: string,
    userId: string,
    pagination: PaginationQueryDto,
  ) {
    const { page, limit } = pagination;
    const where = { tenantId, userId };
    const [data, total, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...where, isRead: false } }),
    ]);
    return { data, total, page, limit, unread };
  }

  async markAsRead(tenantId: string, userId: string, id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, tenantId, userId },
      data: { isRead: true },
    });
    if (result.count === 0) {
      throw new NotFoundException('Không tìm thấy notification');
    }
    return { id };
  }

  async markAllAsRead(tenantId: string, userId: string) {
    await this.prisma.notification.updateMany({
      where: { tenantId, userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }
}

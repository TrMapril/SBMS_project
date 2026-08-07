import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import { NotificationPayload } from './types/notification-payload.type';

/**
 * Socket.io theo đúng Mục "Quy ước Socket.io" plan.md: join room
 * `tenant:{tenantId}:user:{userId}`, tên event = `payload.type`, payload luôn dạng
 * `{ type, data, timestamp }`. Xác thực bằng JWT gửi qua `socket.handshake.auth.token` — không
 * dùng cookie/session vì FE lưu token trong Zustand store (không phải cookie), giống cách HTTP
 * API xác thực qua Bearer token.
 */
@Injectable()
@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) {
        throw new Error('Thiếu token xác thực');
      }
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
      if (!payload.tenantId) {
        throw new Error('Tài khoản không thuộc tenant nào');
      }
      await client.join(this.room(payload.tenantId, payload.userId));
    } catch (error) {
      this.logger.warn(
        `Kết nối Socket.io bị từ chối: ${(error as Error).message}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect() {
    // Socket.io tự rời room khi client disconnect — không cần dọn thêm.
  }

  private room(tenantId: string, userId: string): string {
    return `tenant:${tenantId}:user:${userId}`;
  }

  emitToUser(tenantId: string, userId: string, payload: NotificationPayload) {
    this.server.to(this.room(tenantId, userId)).emit(payload.type, payload);
  }
}

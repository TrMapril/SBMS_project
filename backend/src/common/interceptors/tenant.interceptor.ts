import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthenticatedRequest } from '../types/jwt-payload.type';

/**
 * Đọc tenantId từ JWT (đã được JwtAuthGuard gắn vào request.user) và gắn vào
 * request.tenantId để Service dùng filter mọi query (Mục 3.12 CLAUDE.md).
 * Chỉ áp dụng cho route thuộc tenant — không dùng cho endpoint Super Admin.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user?.tenantId) {
      throw new ForbiddenException('Tài khoản không thuộc tenant nào');
    }
    request.tenantId = request.user.tenantId;
    return next.handle();
  }
}

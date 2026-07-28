import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest } from '../types/jwt-payload.type';

/**
 * tenantId đã được TenantInterceptor xác thực và gắn vào request từ JWT.
 * Dùng trong Service để filter mọi query theo tenant (Mục 3.12 CLAUDE.md).
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.tenantId as string;
  },
);

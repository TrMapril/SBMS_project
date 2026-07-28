import { Request } from 'express';
import { SystemRole } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  tenantId: string | null;
  systemRole: SystemRole;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
  tenantId?: string | null;
}

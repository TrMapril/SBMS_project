import { IsIn, IsOptional, IsString } from 'class-validator';
import { SystemRole, UserStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const SYSTEM_ROLES: SystemRole[] = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'];
const USER_STATUSES: UserStatus[] = ['ACTIVE', 'LOCKED', 'PENDING'];

/** Phase 7.5 Đợt 2 — Trang User đổi sang dạng bảng có tìm kiếm theo họ tên/email + lọc theo
 * trạng thái/vai trò hệ thống. */
export class ListUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: UserStatus;

  @IsOptional()
  @IsIn(SYSTEM_ROLES)
  systemRole?: SystemRole;
}

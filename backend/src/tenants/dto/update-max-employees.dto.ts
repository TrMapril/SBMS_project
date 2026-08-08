import { IsInt, IsOptional, Min } from 'class-validator';

/** Phase 7.5 Đợt 1 mục F — chỉ Super Admin sửa được, tách khỏi UpdateTenantConfigDto (Admin tự
 * quản lý) để không thể tự nâng giới hạn của chính mình qua PATCH /tenants/me/config. */
export class UpdateMaxEmployeesDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  maxEmployees?: number | null;
}

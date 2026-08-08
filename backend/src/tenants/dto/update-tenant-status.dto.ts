import { IsBoolean } from 'class-validator';

/** Phase 7.5 Đợt 4 — Super Admin vô hiệu hoá/kích hoạt lại 1 tenant. */
export class UpdateTenantStatusDto {
  @IsBoolean()
  isDisabled: boolean;
}

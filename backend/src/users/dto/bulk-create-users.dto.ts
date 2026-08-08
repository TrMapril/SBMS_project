import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, MinLength, ValidateNested } from 'class-validator';

export class BulkCreateUserRowDto {
  @IsString()
  @MinLength(1)
  fullName: string;

  @IsOptional()
  @IsUUID()
  roleId?: string;
}

/** Phase 7.5 Đợt 2 — Admin thêm nhiều Employee cùng lúc, mỗi dòng chỉ cần họ tên + Custom Role
 * tuỳ chọn. Email/mật khẩu tạm sinh tự động ở Service. Giới hạn 100 dòng/lần — đủ dùng cho quy mô
 * đồ án, tránh 1 request tạo hàng nghìn user. */
export class BulkCreateUsersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BulkCreateUserRowDto)
  rows: BulkCreateUserRowDto[];
}

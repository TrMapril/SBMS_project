import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RequestTypeFieldDto {
  @IsString()
  @MinLength(1)
  key: string;

  @IsString()
  @MinLength(1)
  label: string;

  @IsBoolean()
  required: boolean;
}

/** Phase 7.5 Đợt 2 — Admin định nghĩa "loại đơn mẫu" gồm tên + danh sách trường tự do cần điền
 * (chỉ dạng text, xem ghi chú ở `RequestTypeTemplate` trong schema.prisma). */
export class CreateRequestTypeDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RequestTypeFieldDto)
  fields: RequestTypeFieldDto[];
}

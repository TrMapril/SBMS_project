import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

const REQUEST_TYPES = ['LEAVE', 'TASK_RETURN', 'CUSTOM'] as const;

/**
 * Phase 7.5 Đợt 1 mục D — `type` quyết định field nào bắt buộc: `LEAVE` cần `startDate`/`endDate`,
 * `TASK_RETURN` cần `taskId`. Không dùng decorator điều kiện phức tạp (ví dụ `@ValidateIf`) mà
 * validate rẽ nhánh ngay trong Service — đúng Mục 3.5/3.6 CLAUDE.md ("không xây rule engine tổng
 * quát"), nhất quán với cách `TransitionCondition` đã xử lý.
 * Phase 7.5 Đợt 2 — thêm `CUSTOM` cần `requestTypeId` + `customFieldValues` (loại đơn mẫu do
 * Admin tự định nghĩa).
 */
export class CreateLeaveRequestDto {
  @IsOptional()
  @IsIn(REQUEST_TYPES)
  type?: (typeof REQUEST_TYPES)[number];

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsUUID()
  requestTypeId?: string;

  // Request đi qua multipart/form-data (kèm file đính kèm tuỳ chọn) nên field này tới dưới dạng
  // chuỗi JSON, không phải object thật — parse trước khi validate @IsObject(), giữ nguyên object
  // nếu request là application/json thường (không qua multipart).
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? JSON.parse(value) : value))
  @IsObject()
  customFieldValues?: Record<string, unknown>;

  @IsString()
  @MinLength(1)
  reason: string;
}

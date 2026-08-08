import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

const REQUEST_TYPES = ['LEAVE', 'TASK_RETURN'] as const;

/**
 * Phase 7.5 Đợt 1 mục D — `type` quyết định field nào bắt buộc: `LEAVE` cần `startDate`/`endDate`,
 * `TASK_RETURN` cần `taskId`. Không dùng decorator điều kiện phức tạp (ví dụ `@ValidateIf`) mà
 * validate rẽ nhánh ngay trong Service — đúng Mục 3.5/3.6 CLAUDE.md ("không xây rule engine tổng
 * quát"), nhất quán với cách `TransitionCondition` đã xử lý.
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

  @IsString()
  @MinLength(1)
  reason: string;
}

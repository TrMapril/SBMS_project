import { IsOptional, IsUUID } from 'class-validator';

export class AssignmentSuggestionQueryDto {
  @IsUUID()
  projectId: string;

  /** Mặc định = State bắt đầu (is_start) của Workflow nếu không truyền — dùng khi tạo Task mới. */
  @IsOptional()
  @IsUUID()
  currentStateId?: string;
}

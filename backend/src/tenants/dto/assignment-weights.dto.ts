import { IsNumber, Max, Min } from 'class-validator';

/** 4 tiêu chí Thuật toán 1 (Mục 4.4 tài liệu phân tích thiết kế) — không validate tổng = 1 để
 * Admin tự do thử nghiệm, AssignmentSuggestionService chỉ dùng đúng giá trị đã lưu. */
export class AssignmentWeightsDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  workload: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  onTimeRate: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  stepSpeed: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  returnRate: number;
}

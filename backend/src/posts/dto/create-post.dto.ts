import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

/** Request đi qua multipart/form-data (kèm ảnh đại diện tuỳ chọn) nên `published` tới dưới dạng
 * chuỗi "true"/"false", không phải boolean thật — parse trước khi validate, giữ nguyên nếu request
 * là application/json thường (không qua multipart), giống cách `customFieldValues` của
 * `leave_requests` đã xử lý ở Đợt 2. */
function parseBoolean({ value }: { value: unknown }): unknown {
  if (typeof value === 'string') return value === 'true';
  return value;
}

export class CreatePostDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @MinLength(1)
  content: string;

  /** true = xuất bản ngay (publishedAt = now), false/undefined = lưu nháp. */
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  published?: boolean;
}

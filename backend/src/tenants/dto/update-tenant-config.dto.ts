import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AssignmentWeightsDto } from './assignment-weights.dto';

export class UpdateTenantConfigDto {
  @IsOptional()
  @IsString()
  systemName?: string;

  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledModules?: string[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AssignmentWeightsDto)
  assignmentWeights?: AssignmentWeightsDto;

  // Giai đoạn 7 — nội dung trang giới thiệu doanh nghiệp (Mục 4.8 tài liệu phân tích thiết kế).
  // `bannerImages` KHÔNG nằm trong DTO này — quản lý riêng qua endpoint upload/xoá từng ảnh
  // (POST/DELETE .../banner-images), vì cần đếm giới hạn 5 ảnh ngay tại thời điểm upload.

  @IsOptional()
  @IsString()
  introText?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  /** Tự do dạng { facebook?, linkedin?, ... } — không ép cứng danh sách nền tảng mạng xã hội. */
  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;

  // Phase 7.5 Đợt 4 — tuỳ chỉnh background trang giới thiệu doanh nghiệp (màu HOẶC ảnh, dạng URL
  // text giống logoUrl, không phải upload — nhất quán với cách logoUrl đã làm từ Giai đoạn 4).
  @IsOptional()
  @IsString()
  landingBackgroundColor?: string;

  @IsOptional()
  @IsString()
  landingBackgroundImageUrl?: string;
}

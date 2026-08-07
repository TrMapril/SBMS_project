import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

/**
 * Wrapper Supabase Storage dùng chung cho mọi nơi có upload (bannerImages ở tenant_config, file
 * đính kèm leave_requests). Đọc credential từ `process.env` LƯỜI (trong từng method, không phải
 * constructor) — cố ý để app vẫn boot bình thường và mọi tính năng KHÔNG liên quan upload vẫn
 * chạy/test được ngay cả khi người dùng chưa kịp tạo bucket + set env (xem guide.md Phase 7).
 * Chỉ đúng lúc gọi upload/remove mới báo lỗi rõ ràng nếu thiếu cấu hình.
 */
@Injectable()
export class SupabaseStorageService {
  private client: SupabaseClient | null = null;
  private bucket: string | null = null;

  private getClient(): { client: SupabaseClient; bucket: string } {
    if (this.client && this.bucket) {
      return { client: this.client, bucket: this.bucket };
    }
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET;
    if (!url || !serviceRoleKey || !bucket) {
      throw new ServiceUnavailableException(
        'Supabase Storage chưa được cấu hình (thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ' +
          'SUPABASE_STORAGE_BUCKET trong .env) — xem guide.md Phase 7 để tạo bucket và lấy key.',
      );
    }
    this.client = createClient(url, serviceRoleKey);
    this.bucket = bucket;
    return { client: this.client, bucket: this.bucket };
  }

  async upload(
    folder: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
  ): Promise<string> {
    const { client, bucket } = this.getClient();
    const ext = file.originalname.includes('.')
      ? file.originalname.split('.').pop()
      : undefined;
    const path = `${folder}/${randomUUID()}${ext ? `.${ext}` : ''}`;

    const { error } = await client.storage
      .from(bucket)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
    if (error) {
      throw new ServiceUnavailableException(`Upload file thất bại: ${error.message}`);
    }

    const { data } = client.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  /** Xoá theo public URL đã lưu — bỏ qua im lặng nếu URL không thuộc bucket đang cấu hình (dữ
   * liệu cũ/thủ công) hoặc file đã không còn tồn tại, không để lỗi phụ này chặn thao tác chính. */
  async remove(publicUrl: string): Promise<void> {
    const { client, bucket } = this.getClient();
    const marker = `/${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return;
    const path = publicUrl.slice(idx + marker.length);
    await client.storage.from(bucket).remove([path]);
  }
}

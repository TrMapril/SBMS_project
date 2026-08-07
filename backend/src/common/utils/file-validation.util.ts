import { BadRequestException } from '@nestjs/common';

/** Mục "Giới hạn file upload" plan.md — áp dụng mọi nơi có upload (Giai đoạn 7). */
export const MAX_UPLOAD_FILE_SIZE_BYTES = 5 * 1024 * 1024;

interface MagicByteSignature {
  mimeType: string;
  bytes: number[];
}

/** Chỉ liệt kê đúng các định dạng thực tế cần dùng ở Giai đoạn 7 (ảnh banner, file đính kèm đơn
 * từ theo đúng danh sách "PDF, DOCX, JPG, PNG" ở tài liệu phân tích thiết kế Mục "Tech Stack"). */
const SIGNATURES: MagicByteSignature[] = [
  { mimeType: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mimeType: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mimeType: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  // DOCX là 1 file ZIP đóng gói — cùng magic bytes với mọi định dạng OOXML khác.
  {
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    bytes: [0x50, 0x4b, 0x03, 0x04],
  },
];

export interface UploadedFileLike {
  buffer: Buffer;
  size: number;
  mimetype: string;
}

/** Kiểm tra size + magic bytes thật của nội dung file — KHÔNG chỉ tin `mimetype` client khai
 * báo (Mục "Giới hạn file upload" plan.md: "kiểm tra đúng magic bytes theo mime type khai báo,
 * không chỉ tin phần mở rộng file"). Throw 400 rõ lý do nếu không hợp lệ. */
export function assertValidUpload(
  file: UploadedFileLike | undefined,
  allowedMimeTypes: string[],
): void {
  if (!file) {
    throw new BadRequestException('Thiếu file upload');
  }
  if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
    throw new BadRequestException('File vượt quá giới hạn 5MB');
  }
  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new BadRequestException(
      `Định dạng file không được hỗ trợ: ${file.mimetype}`,
    );
  }
  const matched = SIGNATURES.some(
    (sig) =>
      allowedMimeTypes.includes(sig.mimeType) &&
      bufferStartsWith(file.buffer, sig.bytes),
  );
  if (!matched) {
    throw new BadRequestException(
      'Nội dung file không khớp định dạng khai báo',
    );
  }
}

function bufferStartsWith(buffer: Buffer, bytes: number[]): boolean {
  if (buffer.length < bytes.length) return false;
  return bytes.every((b, i) => buffer[i] === b);
}

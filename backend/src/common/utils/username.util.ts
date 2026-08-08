/** Phase 7.5 Đợt 2 — sinh phần local-part của email tự động khi Admin tạo user hàng loạt:
 * bỏ dấu tiếng Việt, viết liền không dấu cách, chữ thường. Vd: "Nguyễn Văn A" -> "nguyenvana". */
export function toUsernameLocalPart(fullName: string): string {
  const withoutMarks = fullName
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
  const cleaned = withoutMarks
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '');
  return cleaned || 'user';
}

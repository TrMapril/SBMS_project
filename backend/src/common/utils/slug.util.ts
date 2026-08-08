/** Phase 7.5 Đợt 5 — sinh slug cho `tenant_posts` từ title: bỏ dấu tiếng Việt, chữ thường, nối
 * bằng dấu gạch ngang (khác `toUsernameLocalPart` viết liền không dấu cách — slug cần đọc được
 * trên URL nên giữ dấu `-` phân tách từ). Vd: "Chào mừng 2026!" -> "chao-mung-2026". */
export function toSlug(title: string): string {
  const withoutMarks = title
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
  const cleaned = withoutMarks
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return cleaned || 'bai-viet';
}

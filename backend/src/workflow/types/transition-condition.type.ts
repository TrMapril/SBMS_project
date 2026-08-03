/**
 * Đúng 2 loại điều kiện hỗ trợ theo Mục 3.5 CLAUDE.md — không mở rộng thêm toán tử/parser.
 */
export interface TransitionCondition {
  requireCustomFields?: string[];
  requireAssignee?: boolean;
}

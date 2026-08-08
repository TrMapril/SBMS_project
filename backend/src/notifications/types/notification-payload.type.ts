/** 4 event gốc liệt kê ở Mục "Quy ước Socket.io" plan.md, + các event bổ sung ở phase_7_5.md
 * (tài liệu mở rộng sau plan.md, tự thêm event mới khi cần — không bị giới hạn vào đúng 4 event
 * gốc như Giai đoạn 7 phải tuân thủ). */
export type NotificationEventType =
  | 'task:assigned'
  | 'task:state-changed'
  | 'task:risk-alert'
  | 'leave-request:resolved'
  | 'project-member:locked';

export interface NotificationPayload<T = Record<string, unknown>> {
  type: NotificationEventType;
  data: T;
  timestamp: string;
}

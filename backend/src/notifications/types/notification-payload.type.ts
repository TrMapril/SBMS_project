/** Đúng 4 event name liệt kê ở Mục "Quy ước Socket.io" plan.md — `leave-request:resolved` chưa
 * dùng ở Giai đoạn 6 vì module `leave_requests` thuộc Giai đoạn 7 chưa làm. */
export type NotificationEventType =
  | 'task:assigned'
  | 'task:state-changed'
  | 'task:risk-alert';

export interface NotificationPayload<T = Record<string, unknown>> {
  type: NotificationEventType;
  data: T;
  timestamp: string;
}

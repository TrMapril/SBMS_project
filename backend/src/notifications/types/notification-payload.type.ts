/** Đúng 4 event name liệt kê ở Mục "Quy ước Socket.io" plan.md. */
export type NotificationEventType =
  | 'task:assigned'
  | 'task:state-changed'
  | 'task:risk-alert'
  | 'leave-request:resolved';

export interface NotificationPayload<T = Record<string, unknown>> {
  type: NotificationEventType;
  data: T;
  timestamp: string;
}

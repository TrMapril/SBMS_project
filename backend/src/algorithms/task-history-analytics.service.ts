import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export interface DwellDuration {
  taskId: string;
  actionBy: string;
  assigneeId: string | null;
  fromStateId: string;
  hours: number;
  actionAt: Date;
}

/**
 * Tính "thời gian task nằm ở 1 State trước khi rời đi" từ task_history — dùng chung cho Thuật
 * toán 1 (tốc độ xử lý bước tương tự — W3) và Thuật toán 3 (bottleneck — avg dwell time/State).
 * Không thuộc riêng domain nào (Workflow/Task) nên đặt trong module `algorithms`, tách biệt khỏi
 * business logic transition thật ở WorkflowEngineService (Mục 3.1 CLAUDE.md — chỉ đọc, không ghi).
 *
 * Công thức: với mỗi task_history row R (task rời R.fromState lúc R.actionAt), thời gian nằm ở
 * R.fromState = R.actionAt trừ đi thời điểm task ĐI VÀO state đó — là actionAt của row task_history
 * liền trước (cùng taskId), hoặc task.createdAt nếu đây là lượt chuyển đầu tiên của task.
 *
 * `actionBy` (ai bấm nút) và `assigneeId` (Task đang giao cho ai) là 2 khái niệm KHÁC NHAU — ví
 * dụ Transition "Pass QA" trong workflow mẫu chỉ Tester được bấm (`allow_roles`), không phải
 * assignee (thường là Developer). Cả Thuật toán 1 lẫn Thuật toán 2 đều lọc/nhóm theo
 * `assigneeId` (không phải `actionBy`) để tránh bị lệch do phân quyền transition — xem
 * AssignmentSuggestionService/RiskScoreService. `actionBy` vẫn trả về trong kết quả (đã có sẵn
 * từ query, không tốn thêm) để nơi gọi tự dùng nếu cần, dù hiện tại chưa nơi nào đọc nó.
 */
@Injectable()
export class TaskHistoryAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async computeDwellDurations(params: {
    tenantId: string;
    fromStateId?: string;
    assigneeId?: string;
    sinceDate?: Date;
  }): Promise<DwellDuration[]> {
    const { tenantId, fromStateId, assigneeId, sinceDate } = params;

    const rows = await this.prisma.taskHistory.findMany({
      where: {
        task: { tenantId, ...(assigneeId ? { assigneeId } : {}) },
        fromStateId: fromStateId ?? { not: null },
        ...(sinceDate ? { actionAt: { gte: sinceDate } } : {}),
      },
      include: { task: { select: { assigneeId: true } } },
      orderBy: { actionAt: 'asc' },
    });
    if (rows.length === 0) return [];

    const taskIds = [...new Set(rows.map((r) => r.taskId))];
    const [allHistoryForTasks, tasks] = await Promise.all([
      this.prisma.taskHistory.findMany({
        where: { taskId: { in: taskIds } },
        orderBy: { actionAt: 'asc' },
      }),
      this.prisma.task.findMany({
        where: { id: { in: taskIds } },
        select: { id: true, createdAt: true },
      }),
    ]);

    const historyByTask = new Map<string, typeof allHistoryForTasks>();
    for (const h of allHistoryForTasks) {
      const list = historyByTask.get(h.taskId) ?? [];
      list.push(h);
      historyByTask.set(h.taskId, list);
    }
    const createdAtByTask = new Map(tasks.map((t) => [t.id, t.createdAt]));

    const results: DwellDuration[] = [];
    for (const row of rows) {
      if (!row.fromStateId) continue;
      const taskHistoryList = historyByTask.get(row.taskId) ?? [];
      const idx = taskHistoryList.findIndex((h) => h.id === row.id);
      const enteredAt =
        idx > 0 ? taskHistoryList[idx - 1].actionAt : createdAtByTask.get(row.taskId);
      if (!enteredAt) continue;

      const hours = (row.actionAt.getTime() - enteredAt.getTime()) / 3_600_000;
      if (hours < 0) continue; // dữ liệu lỗi/giờ hệ thống lệch — bỏ qua thay vì làm sai lệch trung bình

      results.push({
        taskId: row.taskId,
        actionBy: row.actionBy,
        assigneeId: row.task.assigneeId,
        fromStateId: row.fromStateId,
        hours,
        actionAt: row.actionAt,
      });
    }
    return results;
  }

  /** Trung bình cộng đơn giản — trả về `null` nếu không có dữ liệu (gọi nơi dùng tự quyết định giá trị mặc định). */
  average(durations: DwellDuration[]): number | null {
    if (durations.length === 0) return null;
    const sum = durations.reduce((acc, d) => acc + d.hours, 0);
    return sum / durations.length;
  }
}

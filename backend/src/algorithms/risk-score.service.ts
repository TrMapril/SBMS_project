import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Task, WorkflowState } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TaskHistoryAnalyticsService } from './task-history-analytics.service';
import { NotificationsService } from '../notifications/notifications.service';

const TENANT_WIDE_DEFAULT_HOURS_PER_STEP = 24;
const NO_HISTORY_LATE_RATE = 0.5;
const RISK_ALERT_THRESHOLD = 70;

/**
 * Thuật toán 2 — Dự báo nguy cơ trễ deadline (Mục 4.4 tài liệu phân tích thiết kế). Đây là thuật
 * toán được ưu tiên làm kỹ nhất (Mức 2 trong tài liệu, plan.md Giai đoạn 5). Cron chạy mỗi giờ,
 * cập nhật risk_score cho mọi Task đang active (chưa ở State is_end) VÀ có deadline — Task không
 * có deadline giữ risk_score = null (không áp dụng được công thức "% thời gian đã dùng").
 *
 * risk_score (0-100) = trung bình cộng 3 yếu tố (mỗi yếu tố chuẩn hoá [0,1] trước khi *100):
 *   1. % thời gian đã dùng / tổng thời gian cho phép (created_at → deadline).
 *   2. Số bước còn lại (BFS tới State is_end gần nhất) × thời gian xử lý trung bình của assignee
 *      hiện tại, so với số giờ còn lại tới deadline (>1 nghĩa là dự kiến trễ).
 *   3. Tỷ lệ trễ deadline lịch sử của các Task đã hoàn thành trong CÙNG Workflow.
 * Tài liệu không quy định trọng số riêng cho 3 yếu tố này (khác Thuật toán 1 có W1-W4 rõ ràng)
 * nên dùng trung bình cộng đơn giản — giả định ghi trong DECISIONS.md.
 */
@Injectable()
export class RiskScoreService {
  private readonly logger = new Logger(RiskScoreService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: TaskHistoryAnalyticsService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async computeRiskScores() {
    const now = new Date();
    this.logger.log(`Bắt đầu tính risk_score lúc ${now.toISOString()}`);

    const tasks = await this.prisma.task.findMany({
      where: { deadline: { not: null }, currentState: { isEnd: false } },
      include: { currentState: true },
    });

    // Gom Manager/Admin theo tenant 1 lần, tránh query lặp lại cho mỗi Task vượt ngưỡng trong
    // cùng 1 tenant (cron chạy qua Task của MỌI tenant trong 1 lượt).
    const managersByTenant = new Map<string, string[]>();

    let alertCount = 0;
    for (const task of tasks) {
      const risk = await this.computeRiskForTask(task, now);
      await this.prisma.task.update({
        where: { id: task.id },
        data: { riskScore: risk, riskScoreUpdatedAt: now },
      });
      if (risk > RISK_ALERT_THRESHOLD) {
        alertCount++;
        this.logger.warn(
          `Task ${task.id} "${task.title}" risk_score=${risk.toFixed(1)}% (>${RISK_ALERT_THRESHOLD}%)`,
        );

        // Task rủi ro trễ deadline là việc Manager/Admin cần biết để điều phối lại, không phải
        // riêng assignee — giả định ghi trong DECISIONS.md vì tài liệu gốc chỉ nói "cảnh báo",
        // không chỉ rõ người nhận.
        if (!managersByTenant.has(task.tenantId)) {
          const managers = await this.prisma.user.findMany({
            where: { tenantId: task.tenantId, systemRole: { in: ['ADMIN', 'MANAGER'] } },
            select: { id: true },
          });
          managersByTenant.set(task.tenantId, managers.map((m) => m.id));
        }
        const recipients = managersByTenant.get(task.tenantId) ?? [];
        for (const managerId of recipients) {
          await this.notifications.notify(task.tenantId, managerId, 'task:risk-alert', {
            taskId: task.id,
            taskTitle: task.title,
            riskScore: Math.round(risk * 10) / 10,
          });
        }
      }
    }

    this.logger.log(
      `Hoàn tất: ${tasks.length} Task được tính risk_score, ${alertCount} Task vượt ngưỡng ${RISK_ALERT_THRESHOLD}%.`,
    );
    return { computed: tasks.length, alerts: alertCount, computedAt: now };
  }

  /** Danh sách Task rủi ro cho Dashboard — mặc định chỉ lấy Task đã từng được tính risk_score,
   * sắp xếp giảm dần. `threshold` cho phép Dashboard lọc theo mức cảnh báo khác nhau. */
  async getRiskAlerts(tenantId: string, threshold = 0) {
    return this.prisma.task.findMany({
      where: { tenantId, riskScore: { not: null, gte: threshold } },
      orderBy: { riskScore: 'desc' },
      take: 50,
      include: {
        assignee: { select: { id: true, fullName: true } },
        project: { select: { id: true, name: true } },
        currentState: { select: { id: true, name: true } },
      },
    });
  }

  private async computeRiskForTask(
    task: Task & { currentState: WorkflowState },
    now: Date,
  ): Promise<number> {
    const totalMs = task.deadline!.getTime() - task.createdAt.getTime();
    const usedMs = now.getTime() - task.createdAt.getTime();
    const timeUsedRatio = totalMs > 0 ? clamp01(usedMs / totalMs) : 1;

    const remainingSteps = await this.bfsStepsToEnd(
      task.currentState.workflowId,
      task.currentStateId,
    );
    const avgHoursPerStep = task.assigneeId
      ? await this.avgProcessingHours(task.tenantId, task.assigneeId)
      : await this.avgProcessingHours(task.tenantId);
    const estimatedRemainingHours = (remainingSteps ?? 0) * avgHoursPerStep;
    const hoursLeft = Math.max(
      0,
      (task.deadline!.getTime() - now.getTime()) / 3_600_000,
    );
    const projectionRatio =
      hoursLeft > 0
        ? clamp01(estimatedRemainingHours / hoursLeft)
        : estimatedRemainingHours > 0
          ? 1
          : 0;

    const lateRate = await this.historicalLateRateForWorkflow(
      task.tenantId,
      task.currentState.workflowId,
    );

    return ((timeUsedRatio + projectionRatio + lateRate) / 3) * 100;
  }

  /** BFS số transition ngắn nhất từ 1 State tới State is_end gần nhất — chỉ dùng transition
   * đang active. `null` nếu đồ thị không có đường tới bất kỳ State is_end nào (workflow lỗi cấu
   * hình, không nên xảy ra nhưng vẫn phòng hờ thay vì throw giữa cron job). */
  private async bfsStepsToEnd(
    workflowId: string,
    fromStateId: string,
  ): Promise<number | null> {
    const [states, transitions] = await Promise.all([
      this.prisma.workflowState.findMany({ where: { workflowId, isActive: true } }),
      this.prisma.workflowTransition.findMany({
        where: { workflowId, isActive: true },
      }),
    ]);
    const endStateIds = new Set(states.filter((s) => s.isEnd).map((s) => s.id));
    if (endStateIds.has(fromStateId)) return 0;

    const adjacency = new Map<string, string[]>();
    for (const t of transitions) {
      const list = adjacency.get(t.fromStateId) ?? [];
      list.push(t.toStateId);
      adjacency.set(t.fromStateId, list);
    }

    const visited = new Set([fromStateId]);
    let frontier = [fromStateId];
    let steps = 0;
    while (frontier.length > 0 && steps <= states.length) {
      steps++;
      const next: string[] = [];
      for (const stateId of frontier) {
        for (const neighbor of adjacency.get(stateId) ?? []) {
          if (endStateIds.has(neighbor)) return steps;
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            next.push(neighbor);
          }
        }
      }
      frontier = next;
    }
    return null;
  }

  /** Thời gian xử lý trung bình/bước — theo đúng assignee nếu có dữ liệu, ngược lại rơi về
   * trung bình toàn tenant, cuối cùng rơi về hằng số mặc định (tenant hoàn toàn chưa có lịch sử
   * transition nào — ví dụ mới seed xong). Lọc theo `assigneeId` (Task đang giao cho ai), không
   * phải `actionBy` — cùng lý do với AssignmentSuggestionService: bước hoàn tất 1 Task nhiều khi
   * do Tester bấm chứ không phải assignee/Developer, lọc theo action_by sẽ thiếu dữ liệu. */
  private async avgProcessingHours(tenantId: string, assigneeId?: string): Promise<number> {
    const durations = await this.analytics.computeDwellDurations({
      tenantId,
      assigneeId,
    });
    const avg = this.analytics.average(durations);
    if (avg != null) return avg;
    if (assigneeId) return this.avgProcessingHours(tenantId);
    return TENANT_WIDE_DEFAULT_HOURS_PER_STEP;
  }

  private async historicalLateRateForWorkflow(
    tenantId: string,
    workflowId: string,
  ): Promise<number> {
    const rows = await this.prisma.taskHistory.findMany({
      where: {
        task: { tenantId, deadline: { not: null } },
        toState: { isEnd: true, workflowId },
      },
      select: { actionAt: true, task: { select: { deadline: true } } },
    });
    if (rows.length === 0) return NO_HISTORY_LATE_RATE;
    const lateCount = rows.filter(
      (r) => r.task.deadline && r.actionAt > r.task.deadline,
    ).length;
    return lateCount / rows.length;
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

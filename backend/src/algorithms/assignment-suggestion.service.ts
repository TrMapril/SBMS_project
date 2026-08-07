import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { TaskHistoryAnalyticsService } from './task-history-analytics.service';
import {
  AssignmentWeights,
  DEFAULT_ASSIGNMENT_WEIGHTS,
} from './types/assignment-weights.type';

export interface AssignmentSuggestion {
  userId: string;
  fullName: string;
  email: string;
  score: number;
  breakdown: AssignmentWeights;
}

/**
 * Thuật toán 1 — Gợi ý phân công nhân viên (Mục 4.4 tài liệu phân tích thiết kế).
 * 4 tiêu chí, điểm mỗi tiêu chí chuẩn hoá về [0,1] (1 = tốt nhất), tổng điểm = tổng có trọng số.
 * Ứng viên = Employee thuộc project_members của Project (không xét toàn tenant) — Manager chỉ
 * nên thấy gợi ý trong đúng nhóm mình quản lý; giả định ghi trong DECISIONS.md.
 */
@Injectable()
export class AssignmentSuggestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: TaskHistoryAnalyticsService,
    private readonly tenantsService: TenantsService,
  ) {}

  async getSuggestions(
    tenantId: string,
    projectId: string,
    currentStateId?: string,
  ): Promise<AssignmentSuggestion[]> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
    });
    if (!project) {
      throw new NotFoundException('Không tìm thấy Project trong tenant');
    }

    const targetStateId =
      currentStateId ?? (await this.resolveStartStateId(project.workflowId));
    if (!targetStateId) {
      throw new BadRequestException(
        'Workflow của Project chưa có State bắt đầu (is_start)',
      );
    }

    const members = await this.prisma.projectMember.findMany({
      where: { projectId, user: { systemRole: 'EMPLOYEE' } },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
    if (members.length === 0) return [];
    const userIds = members.map((m) => m.userId);

    // Đọc qua TenantsService (đã cache — Mục 3.8 CLAUDE.md), không tự query tenantConfig trực
    // tiếp nữa để tránh 2 nơi cache/đọc rời rạc cho cùng 1 dữ liệu.
    const config = await this.tenantsService.getMyConfig(tenantId);
    const weights =
      (config.assignmentWeights as unknown as AssignmentWeights) ??
      DEFAULT_ASSIGNMENT_WEIGHTS;

    const [workloadScores, onTimeScores, stepSpeedScores, returnScores] =
      await Promise.all([
        this.computeWorkloadScores(tenantId, userIds),
        this.computeOnTimeScores(tenantId, userIds),
        this.computeStepSpeedScores(tenantId, targetStateId, userIds),
        this.computeReturnRateScores(tenantId, userIds),
      ]);

    const results: AssignmentSuggestion[] = members.map((m) => {
      const breakdown: AssignmentWeights = {
        workload: workloadScores.get(m.userId) ?? 1,
        onTimeRate: onTimeScores.get(m.userId) ?? 0.5,
        stepSpeed: stepSpeedScores.get(m.userId) ?? 0.5,
        returnRate: returnScores.get(m.userId) ?? 0.5,
      };
      const score =
        weights.workload * breakdown.workload +
        weights.onTimeRate * breakdown.onTimeRate +
        weights.stepSpeed * breakdown.stepSpeed +
        weights.returnRate * breakdown.returnRate;
      return {
        userId: m.userId,
        fullName: m.user.fullName,
        email: m.user.email,
        score: Math.round(score * 1000) / 1000,
        breakdown,
      };
    });

    return results.sort((a, b) => b.score - a.score);
  }

  private async resolveStartStateId(workflowId: string): Promise<string | null> {
    const state = await this.prisma.workflowState.findFirst({
      where: { workflowId, isStart: true, isActive: true },
    });
    return state?.id ?? null;
  }

  /** Tải công việc hiện tại (W1) — Task đang active (current state chưa is_end) của assignee.
   * Điểm = 1/(1+count): không cần biết "mức tải tối đa" của ai khác để chuẩn hoá, càng ít Task
   * đang chạy càng gần 1. */
  private async computeWorkloadScores(tenantId: string, userIds: string[]) {
    const counts = await this.prisma.task.groupBy({
      by: ['assigneeId'],
      where: {
        tenantId,
        assigneeId: { in: userIds },
        currentState: { isEnd: false },
      },
      _count: { _all: true },
    });
    const map = new Map<string, number>();
    for (const uid of userIds) map.set(uid, 1);
    for (const c of counts) {
      if (c.assigneeId) map.set(c.assigneeId, 1 / (1 + c._count._all));
    }
    return map;
  }

  /** Tỷ lệ hoàn thành đúng hạn (W2) — trong số Task ĐANG GIAO cho ứng viên đã hoàn thành
   * (transition vào State is_end) VÀ có deadline, tỷ lệ action_at <= deadline. Cố ý lọc theo
   * `task.assigneeId` chứ KHÔNG phải `task_history.action_by`: transition cuối (ví dụ "Pass QA")
   * trong workflow mẫu chỉ Tester được phép bấm (`allow_roles`), không phải assignee/Developer —
   * nếu lọc theo action_by, Developer sẽ gần như không bao giờ có dữ liệu W2 vì họ không tự bấm
   * bước hoàn tất. Không có dữ liệu → điểm trung lập 0.5. */
  private async computeOnTimeScores(tenantId: string, userIds: string[]) {
    const rows = await this.prisma.taskHistory.findMany({
      where: {
        task: { tenantId, assigneeId: { in: userIds }, deadline: { not: null } },
        toState: { isEnd: true },
      },
      select: {
        actionAt: true,
        task: { select: { assigneeId: true, deadline: true } },
      },
    });
    const totals = new Map<string, { onTime: number; total: number }>();
    for (const r of rows) {
      const assigneeId = r.task.assigneeId;
      if (!assigneeId) continue;
      const t = totals.get(assigneeId) ?? { onTime: 0, total: 0 };
      t.total += 1;
      if (r.task.deadline && r.actionAt <= r.task.deadline) t.onTime += 1;
      totals.set(assigneeId, t);
    }
    const map = new Map<string, number>();
    for (const uid of userIds) {
      const t = totals.get(uid);
      map.set(uid, t && t.total > 0 ? t.onTime / t.total : 0.5);
    }
    return map;
  }

  /** Tốc độ xử lý loại bước tương tự (W3) — thời gian trung bình State mà ứng viên ĐANG GIAO
   * từng nằm ở ĐÚNG State mà Task mới sẽ bắt đầu, chuẩn hoá tương đối trong chính nhóm ứng viên
   * đang so sánh (nhanh nhất = 1, chậm nhất = 0). Dùng `assigneeId` thay vì `actionBy` cùng lý do
   * với W2 — xem `TaskHistoryAnalyticsService`. */
  private async computeStepSpeedScores(
    tenantId: string,
    stateId: string,
    userIds: string[],
  ) {
    const byUser = new Map<string, number[]>();
    await Promise.all(
      userIds.map(async (uid) => {
        const durations = await this.analytics.computeDwellDurations({
          tenantId,
          fromStateId: stateId,
          assigneeId: uid,
        });
        if (durations.length > 0) {
          byUser.set(
            uid,
            durations.map((d) => d.hours),
          );
        }
      }),
    );
    const avgByUser = new Map<string, number>();
    for (const [uid, hoursList] of byUser) {
      avgByUser.set(uid, hoursList.reduce((a, b) => a + b, 0) / hoursList.length);
    }

    const map = new Map<string, number>();
    const values = [...avgByUser.values()];
    if (values.length === 0) {
      for (const uid of userIds) map.set(uid, 0.5);
      return map;
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    for (const uid of userIds) {
      const avg = avgByUser.get(uid);
      if (avg === undefined) {
        map.set(uid, 0.5);
        continue;
      }
      map.set(uid, max > min ? (max - avg) / (max - min) : 1);
    }
    return map;
  }

  /** Tỷ lệ bị trả về (W4) — transition được xem là "trả về" khi to_state.order_index nhỏ hơn
   * from_state.order_index (đi ngược flow, ví dụ Review → Development), tính trên các Task ĐANG
   * GIAO cho ứng viên (assigneeId) — cùng lý do dùng assigneeId thay vì action_by như W2/W3: bản
   * thân hành động "trả về" trong workflow mẫu do Tester bấm, không phải Developer/assignee, nên
   * đo theo action_by sẽ luôn ra 0 (không có ý nghĩa phân biệt ứng viên). Điểm = 1 - returnRate. */
  private async computeReturnRateScores(tenantId: string, userIds: string[]) {
    const rows = await this.prisma.taskHistory.findMany({
      where: { task: { tenantId, assigneeId: { in: userIds } } },
      select: {
        task: { select: { assigneeId: true } },
        fromState: { select: { orderIndex: true } },
        toState: { select: { orderIndex: true } },
      },
    });
    const totals = new Map<string, { backward: number; total: number }>();
    for (const r of rows) {
      if (!r.fromState || !r.task.assigneeId) continue;
      const assigneeId = r.task.assigneeId;
      const t = totals.get(assigneeId) ?? { backward: 0, total: 0 };
      t.total += 1;
      if (r.toState.orderIndex < r.fromState.orderIndex) t.backward += 1;
      totals.set(assigneeId, t);
    }
    const map = new Map<string, number>();
    for (const uid of userIds) {
      const t = totals.get(uid);
      const returnRate = t && t.total > 0 ? t.backward / t.total : null;
      map.set(uid, returnRate === null ? 0.5 : 1 - returnRate);
    }
    return map;
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TaskHistoryAnalyticsService } from './task-history-analytics.service';

const DEFAULT_WINDOW_DAYS = 30;
const MS_PER_DAY = 86_400_000;

export interface StateBottleneckStat {
  stateId: string;
  stateName: string;
  avgDwellHours: number | null;
  taskCount: number;
  deltaHoursVsPrevious: number | null;
}

export interface TransitionBottleneckStat {
  transitionId: string;
  name: string;
  fromStateId: string;
  fromStateName: string;
  toStateId: string;
  toStateName: string;
  isBackward: boolean;
  count: number;
}

/**
 * Thuật toán 3 — Phát hiện bottleneck quy trình (Mục 4.4 tài liệu phân tích thiết kế). Job định
 * kỳ (chọn chạy 1 lần/ngày — tài liệu/plan.md không quy định lịch cụ thể như Thuật toán 2, xem
 * DECISIONS.md) phân tích task_history 30 ngày gần nhất của TỪNG Workflow, lưu kết quả vào
 * `bottleneck_snapshots` để Dashboard đọc lại, không tính realtime mỗi lần load trang.
 *
 * 2 chỉ số mỗi lần chạy:
 *   1. State nào có avg dwell time (thời gian trung bình Task nằm ở State đó) cao nhất.
 *   2. Transition nào có tỷ lệ thực hiện theo chiều ngược (to_state.order_index nhỏ hơn
 *      from_state.order_index — ví dụ Review → Development) cao nhất.
 * So sánh với snapshot liền trước của CÙNG Workflow để tính delta (xu hướng tốt lên/xấu đi).
 */
@Injectable()
export class BottleneckService {
  private readonly logger = new Logger(BottleneckService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: TaskHistoryAnalyticsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async computeAllSnapshots() {
    const workflows = await this.prisma.workflow.findMany({
      where: { isActive: true },
      select: { id: true, tenantId: true, name: true },
    });
    this.logger.log(`Bắt đầu tính bottleneck snapshot cho ${workflows.length} workflow.`);
    for (const wf of workflows) {
      await this.computeSnapshotForWorkflow(wf.tenantId, wf.id);
    }
    this.logger.log('Hoàn tất tính bottleneck snapshot.');
  }

  async computeSnapshotForWorkflow(
    tenantId: string,
    workflowId: string,
    windowDays = DEFAULT_WINDOW_DAYS,
  ) {
    // Endpoint thủ công (AlgorithmsController) nhận workflowId trực tiếp từ client — phải xác
    // thực thuộc đúng tenant trước khi đọc/ghi, tránh lộ cấu trúc Workflow của tenant khác qua
    // workflowId đoán được (job cron nội bộ luôn truyền đúng cặp tenantId/workflowId nên không
    // tốn thêm gì đáng kể khi kiểm tra lại ở đây).
    const workflow = await this.prisma.workflow.findFirst({
      where: { id: workflowId, tenantId },
    });
    if (!workflow) {
      throw new NotFoundException('Không tìm thấy Workflow trong tenant');
    }

    const since = new Date(Date.now() - windowDays * MS_PER_DAY);

    const states = await this.prisma.workflowState.findMany({
      where: { workflowId, isActive: true },
    });
    const stateStats: StateBottleneckStat[] = [];
    for (const state of states) {
      const durations = await this.analytics.computeDwellDurations({
        tenantId,
        fromStateId: state.id,
        sinceDate: since,
      });
      stateStats.push({
        stateId: state.id,
        stateName: state.name,
        avgDwellHours: this.analytics.average(durations),
        taskCount: durations.length,
        deltaHoursVsPrevious: null, // gán ở dưới sau khi có snapshot liền trước
      });
    }

    const transitions = await this.prisma.workflowTransition.findMany({
      where: { workflowId },
      include: { fromState: true, toState: true },
    });
    const historyRows = await this.prisma.taskHistory.findMany({
      where: {
        task: { tenantId },
        transitionId: { in: transitions.map((t) => t.id) },
        actionAt: { gte: since },
      },
      select: { transitionId: true },
    });
    const countByTransition = new Map<string, number>();
    for (const r of historyRows) {
      if (!r.transitionId) continue;
      countByTransition.set(
        r.transitionId,
        (countByTransition.get(r.transitionId) ?? 0) + 1,
      );
    }
    let backwardCount = 0;
    const transitionStats: TransitionBottleneckStat[] = transitions.map((t) => {
      const count = countByTransition.get(t.id) ?? 0;
      const isBackward = t.toState.orderIndex < t.fromState.orderIndex;
      if (isBackward) backwardCount += count;
      return {
        transitionId: t.id,
        name: t.name,
        fromStateId: t.fromStateId,
        fromStateName: t.fromState.name,
        toStateId: t.toStateId,
        toStateName: t.toState.name,
        isBackward,
        count,
      };
    });
    const totalCount = historyRows.length;
    const overallBackwardRate = totalCount > 0 ? backwardCount / totalCount : 0;

    const previous = await this.prisma.bottleneckSnapshot.findFirst({
      where: { workflowId },
      orderBy: { computedAt: 'desc' },
    });
    let deltaBackwardRateVsPrevious: number | null = null;
    if (previous) {
      deltaBackwardRateVsPrevious = overallBackwardRate - previous.overallBackwardRate;
      const prevStateStats =
        (previous.stateStats as unknown as StateBottleneckStat[]) ?? [];
      for (const s of stateStats) {
        const prevMatch = prevStateStats.find((p) => p.stateId === s.stateId);
        s.deltaHoursVsPrevious =
          prevMatch?.avgDwellHours != null && s.avgDwellHours != null
            ? s.avgDwellHours - prevMatch.avgDwellHours
            : null;
      }
    }

    return this.prisma.bottleneckSnapshot.create({
      data: {
        tenantId,
        workflowId,
        windowDays,
        stateStats: stateStats as unknown as Prisma.InputJsonValue,
        transitionStats: transitionStats as unknown as Prisma.InputJsonValue,
        overallBackwardRate,
        deltaBackwardRateVsPrevious,
      },
    });
  }

  async getLatestSnapshot(tenantId: string, workflowId: string) {
    return this.prisma.bottleneckSnapshot.findFirst({
      where: { tenantId, workflowId },
      orderBy: { computedAt: 'desc' },
    });
  }
}

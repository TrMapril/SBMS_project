import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SystemRole, WorkflowTransition } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TransitionCondition } from './types/transition-condition.type';
import {
  WorkflowCacheService,
  WorkflowStructure,
} from './workflow-cache.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface TransitionParams {
  tenantId: string;
  taskId: string;
  userId: string;
  requesterSystemRole: SystemRole;
  transitionId: string;
  expectedVersion: number;
  comment?: string;
}

/**
 * Lõi "workflow là dữ liệu cấu hình" (Mục 3.1 CLAUDE.md). Đây là NƠI DUY NHẤT xử lý chuyển
 * trạng thái Task — không viết logic transition ở bất kỳ module nào khác (kể cả Giai đoạn 3).
 *
 * Implement đúng 7 bước:
 *   1. Lấy trạng thái hiện tại (đọc 1 lần duy nhất, dùng làm snapshot cho mọi bước sau — kèm
 *      so khớp version với snapshot này ngay lập tức để phân loại đúng 409 khi có xung đột
 *      đồng thời, tránh bị bước 2 báo nhầm 400 "transition không hợp lệ")
 *   2. Tìm transition hợp lệ từ trạng thái hiện tại
 *   3. Kiểm tra quyền theo Custom Role (allow_roles)
 *   4. Kiểm tra condition (requireCustomFields / requireAssignee)
 *   5. Update current_state_id kèm optimistic locking (version) — điều kiện version trong
 *      UPDATE vẫn giữ lại làm lớp chốt cuối cho phần race window còn sót giữa bước 1 và bước 5
 *   6. Ghi task_history
 *   7. Hook automation rỗng cho tương lai
 */
@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowCache: WorkflowCacheService,
    private readonly notifications: NotificationsService,
  ) {}

  async transition(params: TransitionParams) {
    const {
      tenantId,
      taskId,
      userId,
      requesterSystemRole,
      transitionId,
      expectedVersion,
      comment,
    } = params;

    // Bước 1: lấy trạng thái hiện tại — đọc DUY NHẤT 1 LẦN, dùng làm snapshot chung cho mọi
    // bước kiểm tra bên dưới (không đọc lại task ở đâu khác trong hàm này). Kèm workflowId của
    // Project (qua currentState, không cần join thêm bảng) để tra cấu trúc Workflow trong cache.
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, tenantId },
      include: { currentState: { select: { workflowId: true } } },
    });
    if (!task) {
      throw new NotFoundException('Không tìm thấy Task');
    }

    // Kiểm tra version NGAY sau khi đọc snapshot, trước khi đánh giá bất kỳ business rule nào
    // khác (Mục 3.7 CLAUDE.md). Lý do: nếu request này đọc snapshot SAU KHI một request khác đã
    // commit transition trước đó, task.currentStateId ở đây đã là trạng thái MỚI — nếu để bước 2
    // (tìm transition khớp fromStateId) chạy trước, nó sẽ báo nhầm 400 "transition không hợp lệ"
    // thay vì 409, vì không còn transition nào khớp trạng thái mới đó. So khớp version trước tiên
    // đảm bảo mọi xung đột đồng thời luôn được phân loại đúng là 409, không bị bước sau che mất
    // nguyên nhân thật.
    if (task.version !== expectedVersion) {
      throw new ConflictException(
        'Task đã bị thay đổi bởi thao tác khác (version không khớp)',
      );
    }

    // Bước 2: tìm transition hợp lệ từ trạng thái hiện tại (dùng snapshot ở Bước 1, không đọc
    // lại) — đọc từ cấu trúc Workflow đã cache (Mục 3.8 CLAUDE.md), không query DB trực tiếp mỗi
    // lần transition.
    const structure = await this.getStructure(task.currentState.workflowId);
    const transition = structure.transitions.find(
      (t) => t.id === transitionId && t.fromStateId === task.currentStateId,
    );
    if (!transition) {
      throw new BadRequestException(
        'Transition không hợp lệ từ trạng thái hiện tại của Task',
      );
    }

    // Bước 3: kiểm tra quyền theo Custom Role — KHÔNG dùng System Role (Mục 3.2)
    await this.assertRolePermission(userId, transition);

    // Phase 7.5 Đợt 3 (thu hẹp sau khi test tay) — CỘNG THÊM vào allow_roles (không thay thế):
    // actor phải là assignee của Task. CHỈ Admin còn được bypass (hỗ trợ khẩn cấp) — Manager
    // KHÔNG còn bypass nữa, tránh làm sai lệch dữ liệu `action_by` dùng để đánh giá năng lực
    // (Manager tự transition thay Employee sẽ khiến hệ thống ghi nhận nhầm là chính Manager thực
    // hiện bước đó). Manager muốn giao Task cho người khác thực hiện thì dùng "Đổi assignee"
    // (`PATCH /tasks/:id/assignee`), không tự transition thay được nữa.
    this.assertIsAssignee(requesterSystemRole, userId, transition, task);

    // Bước 4: kiểm tra condition — chỉ 2 loại (Mục 3.5)
    await this.assertCondition(transition, task);

    // Bước 5 + 6: update kèm optimistic locking + ghi task_history, atomic trong 1 transaction
    await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.task.updateMany({
        where: { id: taskId, version: expectedVersion },
        data: {
          currentStateId: transition.toStateId,
          version: { increment: 1 },
        },
      });
      if (updateResult.count === 0) {
        throw new ConflictException(
          'Task đã bị thay đổi bởi thao tác khác (version không khớp)',
        );
      }

      return tx.taskHistory.create({
        data: {
          taskId,
          fromStateId: transition.fromStateId,
          toStateId: transition.toStateId,
          transitionId: transition.id,
          actionBy: userId,
          comment: comment ?? null,
        },
      });
    });

    // Bước 7: hook automation rỗng cho tương lai (Mục "Quy ước chuẩn" trong plan.md) — Giai đoạn
    // 6 nối thêm đúng 1 việc cụ thể vào hook này: bắn notification `task:state-changed` cho
    // assignee, không mở rộng thành automation engine tổng quát.
    await this.onTransitionCompleted(tenantId, task, transition, structure);

    return this.prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  }

  /**
   * Cấu trúc Workflow (states + transitions active) — cache in-memory, không TTL (Mục 3.8
   * CLAUDE.md). WorkflowService gọi `workflowCache.invalidate(workflowId)` ngay khi Admin sửa
   * State/Transition ở Workflow Builder, đây là NƠI DUY NHẤT đọc lại từ DB sau khi cache miss.
   */
  private async getStructure(workflowId: string): Promise<WorkflowStructure> {
    return this.workflowCache.getOrLoad(workflowId, async () => {
      const [states, transitions] = await Promise.all([
        this.prisma.workflowState.findMany({
          where: { workflowId, isActive: true },
        }),
        this.prisma.workflowTransition.findMany({
          where: { workflowId, isActive: true },
        }),
      ]);
      return { states, transitions };
    });
  }

  private async assertRolePermission(
    userId: string,
    transition: WorkflowTransition,
  ) {
    const allowRoles = (transition.allowRoles as string[]) ?? [];
    if (allowRoles.length === 0) {
      return;
    }
    const matchedCount = await this.prisma.userRole.count({
      where: { userId, roleId: { in: allowRoles } },
    });
    if (matchedCount === 0) {
      throw new ForbiddenException(
        'Không có Custom Role phù hợp để thực hiện Transition này',
      );
    }
  }

  /** Phase 7.5 Đợt 3 (thu hẹp sau khi test tay) — actor phải VỪA có Custom Role trong allow_roles
   * (đã kiểm tra ở `assertRolePermission`) VỪA là assignee của Task. Áp dụng cho MỌI system role
   * TRỪ Admin (bypass để hỗ trợ khẩn cấp) — ban đầu chỉ áp dụng cho Employee, sau khi test tay mở
   * rộng sang cả Manager. Ngoại lệ: bỏ qua ràng buộc assignee khi `allow_roles` rỗng VÀ Task CHƯA
   * có assignee — đúng nguyên văn phase_7_5.md, tránh phá luồng khởi đầu Task (vd transition đầu
   * tiên từ Backlog, chưa ai được giao). */
  private assertIsAssignee(
    requesterSystemRole: SystemRole,
    userId: string,
    transition: WorkflowTransition,
    task: { assigneeId: string | null },
  ) {
    if (requesterSystemRole === 'ADMIN') return;

    const allowRoles = (transition.allowRoles as string[]) ?? [];
    const skipAssigneeCheck =
      allowRoles.length === 0 && task.assigneeId === null;
    if (skipAssigneeCheck) return;

    if (task.assigneeId !== userId) {
      throw new ForbiddenException(
        'Chỉ assignee hiện tại của Task mới được thực hiện Transition này',
      );
    }
  }

  private async assertCondition(
    transition: WorkflowTransition,
    task: { id: string; assigneeId: string | null },
  ) {
    const condition =
      (transition.condition as TransitionCondition | null) ?? null;
    if (!condition) return;

    if (condition.requireAssignee && !task.assigneeId) {
      throw new BadRequestException(
        'Task chưa có assignee, không thể thực hiện Transition này',
      );
    }

    if (
      condition.requireCustomFields &&
      condition.requireCustomFields.length > 0
    ) {
      const existingValues = await this.prisma.customFieldValue.findMany({
        where: {
          taskId: task.id,
          customFieldId: { in: condition.requireCustomFields },
          NOT: { value: '' },
        },
        select: { customFieldId: true },
      });
      const filledIds = new Set(existingValues.map((v) => v.customFieldId));
      const missing = condition.requireCustomFields.filter(
        (fieldId) => !filledIds.has(fieldId),
      );
      if (missing.length > 0) {
        throw new BadRequestException(
          `Thiếu Custom Field bắt buộc: ${missing.join(', ')}`,
        );
      }
    }
  }

  /** Hook automation — vẫn "rỗng" đúng nghĩa (không gửi email/webhook thật), chỉ nối thêm
   * notification realtime cho assignee khi Task đổi trạng thái (xem plan.md). Task không có
   * assignee thì không có ai để báo, bỏ qua — không coi là lỗi. */
  private async onTransitionCompleted(
    tenantId: string,
    task: {
      id: string;
      title: string;
      assigneeId: string | null;
      projectId: string;
    },
    transition: WorkflowTransition,
    structure: WorkflowStructure,
  ) {
    this.logger.log(
      `Task ${task.id} hoàn tất transition "${transition.name}" (${transition.id})`,
    );

    if (!task.assigneeId) return;
    const toState = structure.states.find((s) => s.id === transition.toStateId);
    await this.notifications.notify(
      tenantId,
      task.assigneeId,
      'task:state-changed',
      {
        taskId: task.id,
        taskTitle: task.title,
        transitionName: transition.name,
        toStateId: transition.toStateId,
        toStateName: toState?.name ?? null,
        // Phase 7.5 Đợt 4 — thêm projectId để FE điều hướng thẳng tới Task Board khi bấm notification.
        projectId: task.projectId,
      },
    );
  }
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { WorkflowTransition } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TransitionCondition } from './types/transition-condition.type';

export interface TransitionParams {
  tenantId: string;
  taskId: string;
  userId: string;
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

  constructor(private readonly prisma: PrismaService) {}

  async transition(params: TransitionParams) {
    const { tenantId, taskId, userId, transitionId, expectedVersion, comment } =
      params;

    // Bước 1: lấy trạng thái hiện tại — đọc DUY NHẤT 1 LẦN, dùng làm snapshot chung cho mọi
    // bước kiểm tra bên dưới (không đọc lại task ở đâu khác trong hàm này).
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, tenantId },
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

    // Bước 2: tìm transition hợp lệ từ trạng thái hiện tại (dùng snapshot ở Bước 1, không đọc lại)
    const transition = await this.prisma.workflowTransition.findFirst({
      where: {
        id: transitionId,
        fromStateId: task.currentStateId,
        isActive: true,
      },
    });
    if (!transition) {
      throw new BadRequestException(
        'Transition không hợp lệ từ trạng thái hiện tại của Task',
      );
    }

    // Bước 3: kiểm tra quyền theo Custom Role — KHÔNG dùng System Role (Mục 3.2)
    await this.assertRolePermission(userId, transition);

    // Bước 4: kiểm tra condition — chỉ 2 loại (Mục 3.5)
    this.assertCondition(transition, task);

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

    // Bước 7: hook automation rỗng cho tương lai (Mục "Quy ước chuẩn" trong plan.md)
    this.onTransitionCompleted(taskId, transition);

    return this.prisma.task.findUniqueOrThrow({ where: { id: taskId } });
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

  private assertCondition(
    transition: WorkflowTransition,
    task: { assigneeId: string | null; customFieldValues: unknown },
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
      const values = (task.customFieldValues as Record<string, unknown>) ?? {};
      const missing = condition.requireCustomFields.filter((fieldId) => {
        const value = values[fieldId];
        return value === undefined || value === null || value === '';
      });
      if (missing.length > 0) {
        throw new BadRequestException(
          `Thiếu Custom Field bắt buộc: ${missing.join(', ')}`,
        );
      }
    }
  }

  /** Hook automation rỗng — hiện chỉ log, chưa gửi email/webhook thật (xem plan.md). */
  private onTransitionCompleted(
    taskId: string,
    transition: { id: string; name: string },
  ) {
    this.logger.log(
      `Task ${taskId} hoàn tất transition "${transition.name}" (${transition.id})`,
    );
  }
}

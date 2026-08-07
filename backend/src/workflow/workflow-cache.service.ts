import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { WorkflowState, WorkflowTransition } from '@prisma/client';

export interface WorkflowStructure {
  states: WorkflowState[];
  transitions: WorkflowTransition[];
}

/**
 * Cache duy nhất cho "cấu trúc Workflow" (states + transitions active), dùng chung bởi
 * WorkflowEngineService (đọc, để xác thực Transition) và WorkflowService (ghi, để invalidate
 * ngay khi Admin sửa Workflow Builder) — đúng Mục 3.8 CLAUDE.md: không dùng TTL, invalidate thủ
 * công ngay trong service khi dữ liệu đổi. Tách riêng module này để tránh vòng phụ thuộc giữa
 * WorkflowService và WorkflowEngineService (2 service này không import lẫn nhau).
 */
@Injectable()
export class WorkflowCacheService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  private key(workflowId: string): string {
    return `workflow-structure:${workflowId}`;
  }

  async getOrLoad(
    workflowId: string,
    loader: () => Promise<WorkflowStructure>,
  ): Promise<WorkflowStructure> {
    const cached = await this.cache.get<WorkflowStructure>(this.key(workflowId));
    if (cached) return cached;

    const fresh = await loader();
    await this.cache.set(this.key(workflowId), fresh);
    return fresh;
  }

  async invalidate(workflowId: string): Promise<void> {
    await this.cache.del(this.key(workflowId));
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ImportWorkflowTemplateDto } from './dto/import-workflow-template.dto';
import { CreateWorkflowTemplateDto } from './dto/create-workflow-template.dto';
import { UpdateWorkflowTemplateDto } from './dto/update-workflow-template.dto';
import { WorkflowTemplateDefinition } from './types/workflow-template-definition.type';

@Injectable()
export class WorkflowTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  /** Phase 7.5 Đợt 5 mục 6 — Super Admin tạo Template MỚI luôn bắt đầu rỗng (states/transitions
   * = []), xây đồ thị sau đó qua canvas builder (giống trải nghiệm "tạo Workflow rồi kéo-thả thêm
   * State" đã có cho Workflow thật, không bắt nhập sẵn JSON lúc tạo). */
  async create(dto: CreateWorkflowTemplateDto) {
    return this.prisma.workflowTemplate.create({
      data: {
        name: dto.name,
        description: dto.description,
        definition: { states: [], transitions: [] },
      },
    });
  }

  /** Ghi đè toàn bộ `definition` — canvas builder luôn gửi lại nguyên đồ thị sau mỗi lần Lưu. */
  async update(id: string, dto: UpdateWorkflowTemplateDto) {
    await this.findOne(id);
    return this.prisma.workflowTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        definition: dto.definition
          ? (dto.definition as unknown as object)
          : undefined,
      },
    });
  }

  /** Không cần kiểm tra "đang được dùng" trước khi xoá — import LUÔN clone dữ liệu (Mục 3.10
   * CLAUDE.md, Quyết định #10 DECISIONS.md), Workflow đã import không giữ tham chiếu ngược lại
   * template gốc, nên xoá template không ảnh hưởng bất kỳ Workflow/Task nào đang chạy. */
  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.workflowTemplate.delete({ where: { id } });
    return { id };
  }

  async findAll() {
    return this.prisma.workflowTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.workflowTemplate.findUnique({
      where: { id },
    });
    if (!template) {
      throw new NotFoundException('Không tìm thấy Workflow Template');
    }
    return template;
  }

  /**
   * Import = clone dữ liệu (Mục 3.10 CLAUDE.md): tạo workflows/states/transitions MỚI thuộc
   * tenant, KHÔNG lưu tham chiếu ngược lại template gốc.
   */
  async import(
    tenantId: string,
    templateId: string,
    dto: ImportWorkflowTemplateDto,
  ) {
    const template = await this.findOne(templateId);
    const definition =
      template.definition as unknown as WorkflowTemplateDefinition;

    return this.prisma.$transaction(async (tx) => {
      const workflow = await tx.workflow.create({
        data: { tenantId, name: dto.name ?? template.name },
      });

      const stateIdByTempId = new Map<string, string>();
      for (const stateDef of definition.states) {
        const state = await tx.workflowState.create({
          data: {
            workflowId: workflow.id,
            name: stateDef.name,
            isStart: stateDef.isStart ?? false,
            isEnd: stateDef.isEnd ?? false,
            orderIndex: stateDef.orderIndex ?? 0,
          },
        });
        stateIdByTempId.set(stateDef.tempId, state.id);
      }

      for (const transitionDef of definition.transitions) {
        await tx.workflowTransition.create({
          data: {
            workflowId: workflow.id,
            name: transitionDef.name,
            fromStateId: stateIdByTempId.get(transitionDef.fromTempId)!,
            toStateId: stateIdByTempId.get(transitionDef.toTempId)!,
            allowRoles: [],
            condition: transitionDef.condition
              ? { ...transitionDef.condition }
              : undefined,
          },
        });
      }

      return tx.workflow.findUniqueOrThrow({
        where: { id: workflow.id },
        include: { states: true, transitions: true },
      });
    });
  }
}

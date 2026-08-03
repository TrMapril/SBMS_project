import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ImportWorkflowTemplateDto } from './dto/import-workflow-template.dto';
import { WorkflowTemplateDefinition } from './types/workflow-template-definition.type';

@Injectable()
export class WorkflowTemplateService {
  constructor(private readonly prisma: PrismaService) {}

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

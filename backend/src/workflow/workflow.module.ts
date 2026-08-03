import { Module } from '@nestjs/common';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { WorkflowTemplateController } from './workflow-template.controller';
import { WorkflowTemplateService } from './workflow-template.service';
import { WorkflowEngineService } from './workflow-engine.service';

@Module({
  controllers: [WorkflowController, WorkflowTemplateController],
  providers: [WorkflowService, WorkflowTemplateService, WorkflowEngineService],
  exports: [WorkflowEngineService],
})
export class WorkflowModule {}

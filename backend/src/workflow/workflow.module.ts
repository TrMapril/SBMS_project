import { Module } from '@nestjs/common';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { WorkflowTemplateController } from './workflow-template.controller';
import { WorkflowTemplateService } from './workflow-template.service';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowCacheService } from './workflow-cache.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [WorkflowController, WorkflowTemplateController],
  providers: [
    WorkflowService,
    WorkflowTemplateService,
    WorkflowEngineService,
    WorkflowCacheService,
  ],
  exports: [WorkflowEngineService],
})
export class WorkflowModule {}

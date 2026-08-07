import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { WorkflowModule } from '../workflow/workflow.module';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module';
import { ProjectsModule } from '../projects/projects.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [WorkflowModule, CustomFieldsModule, ProjectsModule, NotificationsModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}

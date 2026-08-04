import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { WorkflowModule } from '../workflow/workflow.module';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module';

@Module({
  imports: [WorkflowModule, CustomFieldsModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}

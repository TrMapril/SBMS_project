import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { WorkflowModule } from './workflow/workflow.module';
import { TasksModule } from './tasks/tasks.module';
import { ProjectsModule } from './projects/projects.module';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';
import { AlgorithmsModule } from './algorithms/algorithms.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    RolesModule,
    WorkflowModule,
    ProjectsModule,
    CustomFieldsModule,
    TasksModule,
    AlgorithmsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

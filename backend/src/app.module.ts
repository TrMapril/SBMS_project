import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    RolesModule,
    WorkflowModule,
    ProjectsModule,
    CustomFieldsModule,
    TasksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

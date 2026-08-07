import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
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
import { NotificationsModule } from './notifications/notifications.module';
import { PublicModule } from './public/public.module';
import { LeaveRequestsModule } from './leave-requests/leave-requests.module';
import { PersonnelModule } from './personnel/personnel.module';
import { EmployeeProfilesModule } from './employee-profiles/employee-profiles.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // Cache in-memory (Mục 3.8 CLAUDE.md) — không set ttl mặc định vì tenant_config và cấu trúc
    // Workflow (2 loại dữ liệu duy nhất dùng cache ở đây) bắt buộc invalidate thủ công ngay khi
    // Admin sửa, không được phép tự hết hạn theo thời gian.
    CacheModule.register({ isGlobal: true }),
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
    NotificationsModule,
    PublicModule,
    LeaveRequestsModule,
    PersonnelModule,
    EmployeeProfilesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

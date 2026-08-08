import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TransitionTaskDto } from './dto/transition-task.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { AssignCustomFieldValuesDto } from './dto/assign-custom-field-values.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantInterceptor } from '../common/interceptors/tenant.interceptor';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';

// Chuyển trạng thái Task (@Post ':id/transition') KHÔNG dùng @Roles(): quyền xét theo Custom
// Role trong WorkflowEngineService (allow_roles), không phải System Role — đúng Mục 3.2
// CLAUDE.md. Xem Task để mở cho mọi thành viên tenant. Tạo Task giới hạn Manager theo đúng tài
// liệu phân tích thiết kế gốc ("Tạo Task, gắn Workflow của project" là việc của Manager).
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Roles('MANAGER')
  @Post()
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(tenantId, dto);
  }

  @Get()
  findAll(
    @CurrentTenant() tenantId: string,
    @Query() query: ListTasksQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.findAll(tenantId, query, user);
  }

  @Get(':id')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.tasksService.findOne(tenantId, id);
  }

  @Patch(':id/custom-fields')
  assignCustomFieldValues(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: AssignCustomFieldValuesDto,
  ) {
    return this.tasksService.assignCustomFieldValues(tenantId, id, dto);
  }

  @Post(':id/transition')
  transition(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: TransitionTaskDto,
  ) {
    return this.tasksService.transition(tenantId, id, user.userId, dto);
  }

  // Không @Roles() — quyền xét theo "là assignee của Task" trong Service, không theo System Role.
  @Post(':id/report-done')
  reportDone(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.tasksService.reportDone(tenantId, id, user.userId);
  }

  @Roles('MANAGER')
  @Post(':id/confirm-done')
  confirmDone(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.tasksService.confirmDone(tenantId, id);
  }
}

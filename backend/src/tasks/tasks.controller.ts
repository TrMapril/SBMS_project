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
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantInterceptor } from '../common/interceptors/tenant.interceptor';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';

// Không dùng @Roles() ở đây: quyền chuyển trạng thái Task xét theo Custom Role trong
// WorkflowEngineService (allow_roles), không phải System Role — đúng Mục 3.2 CLAUDE.md. Việc
// tạo/xem Task cũng để mở cho mọi thành viên tenant đã đăng nhập (plan.md không giới hạn
// riêng ai được tạo Task, khác với Project/Workflow/Custom Field vốn giới hạn rõ Manager/Admin).
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantInterceptor)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(tenantId, dto);
  }

  @Get()
  findAll(
    @CurrentTenant() tenantId: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.tasksService.findAll(tenantId, pagination);
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
}

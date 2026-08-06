import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { CreateWorkflowStateDto } from './dto/create-workflow-state.dto';
import { UpdateWorkflowStateDto } from './dto/update-workflow-state.dto';
import { CreateWorkflowTransitionDto } from './dto/create-workflow-transition.dto';
import { UpdateWorkflowTransitionDto } from './dto/update-workflow-transition.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantInterceptor } from '../common/interceptors/tenant.interceptor';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';

// Đọc (GET) mở cho mọi thành viên tenant đã đăng nhập — Task Board (Giai đoạn 4) cần đọc
// workflow_states/workflow_transitions của project để vẽ Kanban, kể cả Employee. Chỉ các hành
// động GHI (tạo/sửa/xoá Workflow Builder) mới giới hạn Admin, gắn @Roles('ADMIN') riêng từng
// method thay vì ở mức controller.
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
@Controller('workflows')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Roles('ADMIN')
  @Post()
  createWorkflow(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateWorkflowDto,
  ) {
    return this.workflowService.createWorkflow(tenantId, dto);
  }

  @Get()
  findAllWorkflows(
    @CurrentTenant() tenantId: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.workflowService.findAllWorkflows(tenantId, pagination);
  }

  @Get(':id')
  findOneWorkflow(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.workflowService.findOneWorkflow(tenantId, id);
  }

  @Roles('ADMIN')
  @Patch(':id')
  updateWorkflow(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.workflowService.updateWorkflow(tenantId, id, dto);
  }

  @Roles('ADMIN')
  @Delete(':id')
  removeWorkflow(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.workflowService.removeWorkflow(tenantId, id);
  }

  @Roles('ADMIN')
  @Post(':id/states')
  createState(
    @CurrentTenant() tenantId: string,
    @Param('id') workflowId: string,
    @Body() dto: CreateWorkflowStateDto,
  ) {
    return this.workflowService.createState(tenantId, workflowId, dto);
  }

  @Get(':id/states')
  findAllStates(
    @CurrentTenant() tenantId: string,
    @Param('id') workflowId: string,
  ) {
    return this.workflowService.findAllStates(tenantId, workflowId);
  }

  @Roles('ADMIN')
  @Patch(':id/states/:stateId')
  updateState(
    @CurrentTenant() tenantId: string,
    @Param('id') workflowId: string,
    @Param('stateId') stateId: string,
    @Body() dto: UpdateWorkflowStateDto,
  ) {
    return this.workflowService.updateState(tenantId, workflowId, stateId, dto);
  }

  @Roles('ADMIN')
  @Delete(':id/states/:stateId')
  removeState(
    @CurrentTenant() tenantId: string,
    @Param('id') workflowId: string,
    @Param('stateId') stateId: string,
  ) {
    return this.workflowService.removeState(tenantId, workflowId, stateId);
  }

  @Roles('ADMIN')
  @Post(':id/transitions')
  createTransition(
    @CurrentTenant() tenantId: string,
    @Param('id') workflowId: string,
    @Body() dto: CreateWorkflowTransitionDto,
  ) {
    return this.workflowService.createTransition(tenantId, workflowId, dto);
  }

  @Get(':id/transitions')
  findAllTransitions(
    @CurrentTenant() tenantId: string,
    @Param('id') workflowId: string,
  ) {
    return this.workflowService.findAllTransitions(tenantId, workflowId);
  }

  @Roles('ADMIN')
  @Patch(':id/transitions/:transitionId')
  updateTransition(
    @CurrentTenant() tenantId: string,
    @Param('id') workflowId: string,
    @Param('transitionId') transitionId: string,
    @Body() dto: UpdateWorkflowTransitionDto,
  ) {
    return this.workflowService.updateTransition(
      tenantId,
      workflowId,
      transitionId,
      dto,
    );
  }

  @Roles('ADMIN')
  @Delete(':id/transitions/:transitionId')
  removeTransition(
    @CurrentTenant() tenantId: string,
    @Param('id') workflowId: string,
    @Param('transitionId') transitionId: string,
  ) {
    return this.workflowService.removeTransition(
      tenantId,
      workflowId,
      transitionId,
    );
  }
}

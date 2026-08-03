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

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@UseInterceptors(TenantInterceptor)
@Controller('workflows')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

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

  @Patch(':id')
  updateWorkflow(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.workflowService.updateWorkflow(tenantId, id, dto);
  }

  @Delete(':id')
  removeWorkflow(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.workflowService.removeWorkflow(tenantId, id);
  }

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

  @Patch(':id/states/:stateId')
  updateState(
    @CurrentTenant() tenantId: string,
    @Param('id') workflowId: string,
    @Param('stateId') stateId: string,
    @Body() dto: UpdateWorkflowStateDto,
  ) {
    return this.workflowService.updateState(tenantId, workflowId, stateId, dto);
  }

  @Delete(':id/states/:stateId')
  removeState(
    @CurrentTenant() tenantId: string,
    @Param('id') workflowId: string,
    @Param('stateId') stateId: string,
  ) {
    return this.workflowService.removeState(tenantId, workflowId, stateId);
  }

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

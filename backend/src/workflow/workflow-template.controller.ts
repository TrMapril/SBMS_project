import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { WorkflowTemplateService } from './workflow-template.service';
import { ImportWorkflowTemplateDto } from './dto/import-workflow-template.dto';
import { CreateWorkflowTemplateDto } from './dto/create-workflow-template.dto';
import { UpdateWorkflowTemplateDto } from './dto/update-workflow-template.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantInterceptor } from '../common/interceptors/tenant.interceptor';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';

/**
 * `workflow_templates` KHÔNG thuộc riêng tenant nào (dùng chung cho mọi tenant import) — vì vậy
 * `TenantInterceptor` chỉ gắn ở MỨC METHOD cho đúng 1 route thật sự cần `tenantId` (`import`),
 * không gắn ở mức controller (khác hầu hết controller khác trong dự án) — Super Admin có
 * `tenantId = null` nên gắn interceptor ở mức controller sẽ chặn nhầm mọi route Super Admin quản
 * lý Template (Mục 3.12 CLAUDE.md chỉ yêu cầu cách ly TENANT DATA, template không phải dữ liệu
 * của riêng tenant nào).
 *
 * Phase 7.5 Đợt 5 mục 6 — Admin tenant vẫn đọc (GET) + import như cũ; Super Admin đọc + CRUD
 * (POST/PATCH/DELETE) để quản lý bộ template dùng chung cho toàn hệ thống.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('workflow-templates')
export class WorkflowTemplateController {
  constructor(
    private readonly workflowTemplateService: WorkflowTemplateService,
  ) {}

  @Roles('ADMIN', 'SUPER_ADMIN')
  @Get()
  findAll() {
    return this.workflowTemplateService.findAll();
  }

  @Roles('ADMIN', 'SUPER_ADMIN')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.workflowTemplateService.findOne(id);
  }

  @UseInterceptors(TenantInterceptor)
  @Post(':id/import')
  import(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: ImportWorkflowTemplateDto,
  ) {
    return this.workflowTemplateService.import(tenantId, id, dto);
  }

  @Roles('SUPER_ADMIN')
  @Post()
  create(@Body() dto: CreateWorkflowTemplateDto) {
    return this.workflowTemplateService.create(dto);
  }

  @Roles('SUPER_ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWorkflowTemplateDto) {
    return this.workflowTemplateService.update(id, dto);
  }

  @Roles('SUPER_ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.workflowTemplateService.remove(id);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { WorkflowTemplateService } from './workflow-template.service';
import { ImportWorkflowTemplateDto } from './dto/import-workflow-template.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantInterceptor } from '../common/interceptors/tenant.interceptor';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@UseInterceptors(TenantInterceptor)
@Controller('workflow-templates')
export class WorkflowTemplateController {
  constructor(
    private readonly workflowTemplateService: WorkflowTemplateService,
  ) {}

  @Get()
  findAll() {
    return this.workflowTemplateService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.workflowTemplateService.findOne(id);
  }

  @Post(':id/import')
  import(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: ImportWorkflowTemplateDto,
  ) {
    return this.workflowTemplateService.import(tenantId, id, dto);
  }
}

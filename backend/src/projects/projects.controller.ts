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
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantInterceptor } from '../common/interceptors/tenant.interceptor';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MANAGER')
@UseInterceptors(TenantInterceptor)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(tenantId, dto);
  }

  @Get()
  findAll(
    @CurrentTenant() tenantId: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.projectsService.findAll(tenantId, pagination);
  }

  @Get(':id')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.projectsService.findOne(tenantId, id);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.projectsService.remove(tenantId, id);
  }

  @Post(':id/members')
  addMember(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: AddProjectMemberDto,
  ) {
    return this.projectsService.addMember(tenantId, id, dto);
  }

  @Get(':id/members')
  listMembers(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.projectsService.listMembers(tenantId, id);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.projectsService.removeMember(tenantId, id, userId);
  }
}

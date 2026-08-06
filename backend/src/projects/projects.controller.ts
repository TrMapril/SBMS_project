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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';

// Đọc (GET) mở cho mọi thành viên tenant đã đăng nhập — Task Board (Giai đoạn 4) cần đọc
// Project (workflowId, name) kể cả Employee/Manager không phải chủ project. Chỉ hành động GHI
// (tạo/sửa/xoá Project, thêm/xoá member) mới giới hạn Manager, gắn @Roles('MANAGER') riêng từng
// method thay vì ở mức controller.
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Roles('MANAGER')
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
  findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.projectsService.findOne(tenantId, id, user);
  }

  @Roles('MANAGER')
  @Patch(':id')
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(tenantId, id, dto);
  }

  @Roles('MANAGER')
  @Delete(':id')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.projectsService.remove(tenantId, id);
  }

  @Roles('MANAGER')
  @Post(':id/members')
  addMember(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: AddProjectMemberDto,
  ) {
    return this.projectsService.addMember(tenantId, id, dto);
  }

  @Get(':id/members')
  listMembers(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.projectsService.listMembers(tenantId, id, user);
  }

  @Roles('MANAGER')
  @Delete(':id/members/:userId')
  removeMember(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.projectsService.removeMember(tenantId, id, userId);
  }
}

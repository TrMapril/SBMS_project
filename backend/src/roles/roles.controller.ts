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
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantInterceptor } from '../common/interceptors/tenant.interceptor';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@UseInterceptors(TenantInterceptor)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateRoleDto) {
    return this.rolesService.create(tenantId, dto);
  }

  @Get()
  findAll(
    @CurrentTenant() tenantId: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.rolesService.findAll(tenantId, pagination);
  }

  // @Roles() rỗng ghi đè @Roles('ADMIN') ở mức controller — mở cho mọi thành viên tenant đã
  // đăng nhập tự tra Custom Role của chính mình (Task Board Giai đoạn 4 cần để ẩn/hiện nút
  // Transition theo quyền, không được lộ toàn bộ danh sách Custom Role như GET /api/roles).
  // Đặt TRƯỚC @Get(':id') để Nest không khớp "me" vào tham số :id.
  @Roles()
  @Get('me')
  findMyRoles(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rolesService.findMyRoles(tenantId, user.userId);
  }

  // Phase 7.5 Đợt 2 — Admin tra Custom Role hiện tại của 1 user cụ thể (trang User, tính năng
  // "Đổi Custom Role"). Đặt TRƯỚC @Get(':id') để Nest không khớp "by-user" vào tham số :id.
  @Get('by-user/:userId')
  findRolesForUser(
    @CurrentTenant() tenantId: string,
    @Param('userId') userId: string,
  ) {
    return this.rolesService.findRolesForUser(tenantId, userId);
  }

  @Get(':id')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.rolesService.findOne(tenantId, id);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rolesService.update(tenantId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.rolesService.remove(tenantId, id);
  }

  @Post(':id/users')
  assignUser(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.rolesService.assignUser(tenantId, id, dto);
  }

  @Delete(':id/users/:userId')
  unassignUser(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.rolesService.unassignUser(tenantId, id, userId);
  }
}

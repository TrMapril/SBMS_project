import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { LeaveRequestsService } from './leave-requests.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { ResolveLeaveRequestDto } from './dto/resolve-leave-request.dto';
import { ListLeaveRequestsQueryDto } from './dto/list-leave-requests-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantInterceptor } from '../common/interceptors/tenant.interceptor';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';

// Không @Roles() ở mức controller — mở cho mọi user đã đăng nhập trong tenant (Employee/Admin
// gửi đơn/xem đơn của mình, Manager xem+duyệt mọi đơn). Từ Phase 7.5: `resolve`/`reset-task` chỉ
// còn Manager (Admin không còn duyệt được nữa — xem "Quyết định nền tảng" #2 phase_7_5.md).
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
@Controller('leave-requests')
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateLeaveRequestDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.leaveRequestsService.create(tenantId, user.userId, dto, file);
  }

  @Get()
  findAll(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: ListLeaveRequestsQueryDto,
  ) {
    return this.leaveRequestsService.findAll(tenantId, user, query);
  }

  @Get(':id')
  findOne(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.leaveRequestsService.findOne(tenantId, id, user);
  }

  // Phase 7.5 "Quyết định nền tảng" #2 — CHỈ Manager duyệt được, không còn Admin (thu hẹp so với
  // Giai đoạn 7).
  @Roles('MANAGER')
  @Post(':id/resolve')
  resolve(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ResolveLeaveRequestDto,
  ) {
    return this.leaveRequestsService.resolve(tenantId, id, user.userId, dto);
  }

  @Roles('MANAGER')
  @Post(':id/reset-task')
  resetTask(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.leaveRequestsService.resetTask(tenantId, id, user.userId);
  }
}

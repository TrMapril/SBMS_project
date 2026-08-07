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

// Không @Roles() ở mức controller — mở cho mọi user đã đăng nhập trong tenant (Employee gửi
// đơn/xem đơn của mình, Manager/Admin xem+duyệt mọi đơn). Chỉ `resolve` giới hạn Manager/Admin.
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

  @Roles('MANAGER', 'ADMIN')
  @Post(':id/resolve')
  resolve(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ResolveLeaveRequestDto,
  ) {
    return this.leaveRequestsService.resolve(tenantId, id, user.userId, dto);
  }
}

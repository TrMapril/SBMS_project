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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { BulkCreateUsersDto } from './dto/bulk-create-users.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantInterceptor } from '../common/interceptors/tenant.interceptor';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';

// Đọc (GET) mở cho mọi thành viên tenant đã đăng nhập — Manager cần danh sách user để thêm
// project_members, mọi role cần để chọn assignee cho Task (Giai đoạn 4). Tạo user/khoá-mở khoá
// tài khoản vẫn giới hạn Admin, gắn @Roles('ADMIN') riêng từng method thay vì ở mức controller.
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('ADMIN')
  @Post()
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateUserDto) {
    return this.usersService.create(tenantId, dto);
  }

  // Đặt TRƯỚC @Post()/@Get(':id') để Nest không khớp nhầm route.
  @Roles('ADMIN')
  @Post('bulk')
  createBulk(@CurrentTenant() tenantId: string, @Body() dto: BulkCreateUsersDto) {
    return this.usersService.createBulk(tenantId, dto);
  }

  @Get()
  findAll(
    @CurrentTenant() tenantId: string,
    @Query() query: ListUsersQueryDto,
  ) {
    return this.usersService.findAll(tenantId, query);
  }

  @Get(':id')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.usersService.findOne(tenantId, id);
  }

  @Roles('ADMIN')
  @Patch(':id/status')
  updateStatus(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.updateStatus(tenantId, id, dto);
  }
}

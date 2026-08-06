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
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateTenantConfigDto } from './dto/update-tenant-config.dto';
import { CreateTenantAdminDto } from './dto/create-tenant-admin.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantInterceptor } from '../common/interceptors/tenant.interceptor';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { UsersService } from '../users/users.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly usersService: UsersService,
  ) {}

  // Admin của tenant (không phải Super Admin) tự xem/sửa Settings (Giai đoạn 4: khung theme +
  // enabledModules; Giai đoạn 5/7 sẽ thêm trường vào chung DTO này). @Roles('ADMIN') ghi đè
  // @Roles('SUPER_ADMIN') ở mức controller. Đặt TRƯỚC @Get(':id')/@Patch(':id') để Nest không
  // khớp "me" vào tham số :id.
  @Roles('ADMIN')
  @UseInterceptors(TenantInterceptor)
  @Get('me/config')
  getMyConfig(@CurrentTenant() tenantId: string) {
    return this.tenantsService.getMyConfig(tenantId);
  }

  @Roles('ADMIN')
  @UseInterceptors(TenantInterceptor)
  @Patch('me/config')
  updateMyConfig(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateTenantConfigDto,
  ) {
    return this.tenantsService.updateMyConfig(tenantId, dto);
  }

  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get()
  findAll(@Query() pagination: PaginationQueryDto) {
    return this.tenantsService.findAll(pagination);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tenantsService.remove(id);
  }

  /** Bootstrap Admin đầu tiên cho tenant vừa tạo (tenant mới chưa có ai để tự tạo user). */
  @Post(':id/admin')
  async createInitialAdmin(
    @Param('id') id: string,
    @Body() dto: CreateTenantAdminDto,
  ) {
    await this.tenantsService.findOne(id);
    return this.usersService.create(id, { ...dto, systemRole: 'ADMIN' });
  }
}

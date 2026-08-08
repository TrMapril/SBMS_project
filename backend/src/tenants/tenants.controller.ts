import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateTenantConfigDto } from './dto/update-tenant-config.dto';
import { UpdateMaxEmployeesDto } from './dto/update-max-employees.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
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

  /** Phase 7.5 Đợt 5 mục 1 — MỌI role trong tenant (không riêng Admin) cần slug của chính tenant
   * mình để dựng link "/t/:slug" (icon cạnh chuông thông báo). `@Roles()` rỗng ghi đè
   * `@Roles('SUPER_ADMIN')` ở mức controller — cùng cách `GET /roles/me` đã làm ở Mục 16
   * DECISIONS.md (mở cho "quyền của chính tôi", không phải toàn bộ dữ liệu quản trị). */
  @Roles()
  @UseInterceptors(TenantInterceptor)
  @Get('me/slug')
  async getMySlug(@CurrentTenant() tenantId: string) {
    const tenant = await this.tenantsService.findOne(tenantId);
    return { slug: tenant.slug };
  }

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

  @Roles('ADMIN')
  @UseInterceptors(
    TenantInterceptor,
    FileInterceptor('file', { storage: memoryStorage() }),
  )
  @Post('me/config/banner-images')
  addBannerImage(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.tenantsService.addBannerImage(tenantId, file);
  }

  @Roles('ADMIN')
  @UseInterceptors(TenantInterceptor)
  @Delete('me/config/banner-images/:index')
  removeBannerImage(
    @CurrentTenant() tenantId: string,
    @Param('index', ParseIntPipe) index: number,
  ) {
    return this.tenantsService.removeBannerImage(tenantId, index);
  }

  /** Phase 7.5 Đợt 5 mục 2 — logoUrl/landingBackgroundImageUrl trước đây nhập URL thủ công, giờ
   * upload ảnh thật qua Supabase Storage (cùng cơ chế giới hạn 5MB + magic bytes như bannerImages
   * đã có từ Giai đoạn 7). Xoá ảnh cũ khỏi Storage (best-effort) trước khi ghi đè URL mới. */
  @Roles('ADMIN')
  @UseInterceptors(
    TenantInterceptor,
    FileInterceptor('file', { storage: memoryStorage() }),
  )
  @Post('me/config/logo')
  uploadLogo(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.tenantsService.uploadLogo(tenantId, file);
  }

  @Roles('ADMIN')
  @UseInterceptors(
    TenantInterceptor,
    FileInterceptor('file', { storage: memoryStorage() }),
  )
  @Post('me/config/background-image')
  uploadBackgroundImage(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.tenantsService.uploadBackgroundImage(tenantId, file);
  }

  /** Xoá hẳn logo/ảnh nền — khác `PATCH me/config` (chỉ đổi URL text) ở chỗ CÓ dọn file khỏi
   * Storage, cùng tinh thần `removeBannerImage`. Không dùng `PATCH {logoUrl:''}` để xoá vì cách
   * đó chỉ xoá tham chiếu DB, để lại file mồ côi trong bucket. */
  @Roles('ADMIN')
  @UseInterceptors(TenantInterceptor)
  @Delete('me/config/logo')
  removeLogo(@CurrentTenant() tenantId: string) {
    return this.tenantsService.removeLogo(tenantId);
  }

  @Roles('ADMIN')
  @UseInterceptors(TenantInterceptor)
  @Delete('me/config/background-image')
  removeBackgroundImage(@CurrentTenant() tenantId: string) {
    return this.tenantsService.removeBackgroundImage(tenantId);
  }

  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get()
  findAll(@Query() pagination: PaginationQueryDto) {
    return this.tenantsService.findAll(pagination);
  }

  /** Dashboard Super Admin — đặt TRƯỚC @Get(':id') để Nest không khớp "stats" vào tham số :id. */
  @Get('stats/overview')
  getStatsOverview() {
    return this.tenantsService.getStatsOverview();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  /** Phase 7.5 Đợt 1 mục F — kế thừa @Roles('SUPER_ADMIN') ở mức controller, không override. */
  @Patch(':id/max-employees')
  updateMaxEmployees(
    @Param('id') id: string,
    @Body() dto: UpdateMaxEmployeesDto,
  ) {
    return this.tenantsService.updateMaxEmployees(id, dto);
  }

  /** Phase 7.5 Đợt 4 — vô hiệu hoá/kích hoạt lại 1 tenant. */
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateTenantStatusDto) {
    return this.tenantsService.updateStatus(id, dto);
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

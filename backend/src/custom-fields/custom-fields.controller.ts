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
import { CustomFieldsService } from './custom-fields.service';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';
import { UpdateCustomFieldDto } from './dto/update-custom-field.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantInterceptor } from '../common/interceptors/tenant.interceptor';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';

// Đọc (GET) mở cho mọi thành viên tenant đã đăng nhập — cần để UI dịch customFieldId sang tên
// field dễ hiểu khi hiển thị lỗi "thiếu Custom Field bắt buộc" ở Task Board (Giai đoạn 4). Chỉ
// hành động GHI (tạo/sửa/xoá định nghĩa field) mới giới hạn Admin.
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
@Controller('custom-fields')
export class CustomFieldsController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  @Roles('ADMIN')
  @Post()
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateCustomFieldDto) {
    return this.customFieldsService.create(tenantId, dto);
  }

  @Get()
  findAll(
    @CurrentTenant() tenantId: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.customFieldsService.findAll(tenantId, pagination);
  }

  @Get(':id')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.customFieldsService.findOne(tenantId, id);
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomFieldDto,
  ) {
    return this.customFieldsService.update(tenantId, id, dto);
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.customFieldsService.remove(tenantId, id);
  }
}

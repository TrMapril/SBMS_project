import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { RequestTypesService } from './request-types.service';
import { CreateRequestTypeDto } from './dto/create-request-type.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantInterceptor } from '../common/interceptors/tenant.interceptor';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';

// Đọc (GET) mở cho mọi thành viên tenant — Employee/Admin cần danh sách loại đơn để chọn khi gửi
// đơn. Tạo/xoá chỉ Admin, gắn @Roles('ADMIN') riêng từng method thay vì ở mức controller.
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
@Controller('request-types')
export class RequestTypesController {
  constructor(private readonly requestTypesService: RequestTypesService) {}

  @Roles('ADMIN')
  @Post()
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateRequestTypeDto) {
    return this.requestTypesService.create(tenantId, dto);
  }

  @Get()
  findAll(@CurrentTenant() tenantId: string) {
    return this.requestTypesService.findAll(tenantId);
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.requestTypesService.remove(tenantId, id);
  }
}

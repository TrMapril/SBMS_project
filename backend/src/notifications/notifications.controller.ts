import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantInterceptor } from '../common/interceptors/tenant.interceptor';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';

@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findMine(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.notificationsService.findMine(tenantId, user.userId, pagination);
  }

  @Patch('read-all')
  markAllAsRead(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notificationsService.markAllAsRead(tenantId, user.userId);
  }

  @Patch(':id/read')
  markAsRead(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markAsRead(tenantId, user.userId, id);
  }
}

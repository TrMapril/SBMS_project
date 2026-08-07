import { Body, Controller, Get, Param, Patch, UseGuards, UseInterceptors } from '@nestjs/common';
import { EmployeeProfilesService } from './employee-profiles.service';
import { UpdateEmployeeProfileDto } from './dto/update-employee-profile.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantInterceptor } from '../common/interceptors/tenant.interceptor';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';

// Không @Roles() — mọi user trong tenant đều xem được hồ sơ công khai của bất kỳ ai, và tự sửa
// được đúng hồ sơ của chính mình (không cần phân quyền System Role riêng cho việc này).
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
@Controller('employee-profiles')
export class EmployeeProfilesController {
  constructor(private readonly employeeProfilesService: EmployeeProfilesService) {}

  @Patch('me')
  updateMine(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateEmployeeProfileDto,
  ) {
    return this.employeeProfilesService.updateMyProfile(tenantId, user.userId, dto);
  }

  @Get(':userId')
  get(@CurrentTenant() tenantId: string, @Param('userId') userId: string) {
    return this.employeeProfilesService.getPublicProfile(tenantId, userId);
  }
}

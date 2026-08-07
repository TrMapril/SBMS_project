import { Body, Controller, Get, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { CompetencyProfilesService } from './competency-profiles.service';
import { CreateCompetencyProfileDto } from './dto/create-competency-profile.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantInterceptor } from '../common/interceptors/tenant.interceptor';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';

/** Nội bộ, chỉ Manager/Admin xem — khác EmployeeProfilesController công khai. */
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
@Roles('MANAGER', 'ADMIN')
@Controller('competency-profiles')
export class CompetencyProfilesController {
  constructor(private readonly competencyProfilesService: CompetencyProfilesService) {}

  @Post()
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCompetencyProfileDto,
  ) {
    return this.competencyProfilesService.createEntry(tenantId, user.userId, dto);
  }

  @Get(':userId')
  get(@CurrentTenant() tenantId: string, @Param('userId') userId: string) {
    return this.competencyProfilesService.getProfile(tenantId, userId);
  }
}

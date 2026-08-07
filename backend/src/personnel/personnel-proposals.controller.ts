import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { PersonnelProposalsService } from './personnel-proposals.service';
import { CreatePersonnelProposalDto } from './dto/create-personnel-proposal.dto';
import { ResolvePersonnelProposalDto } from './dto/resolve-personnel-proposal.dto';
import { ListPersonnelProposalsQueryDto } from './dto/list-personnel-proposals-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantInterceptor } from '../common/interceptors/tenant.interceptor';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';

@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
@Controller('personnel-proposals')
export class PersonnelProposalsController {
  constructor(private readonly personnelProposalsService: PersonnelProposalsService) {}

  @Roles('MANAGER')
  @Post()
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePersonnelProposalDto,
  ) {
    return this.personnelProposalsService.create(tenantId, user.userId, dto);
  }

  @Roles('MANAGER', 'ADMIN')
  @Get()
  findAll(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: ListPersonnelProposalsQueryDto,
  ) {
    return this.personnelProposalsService.findAll(tenantId, user, query);
  }

  @Roles('ADMIN')
  @Post(':id/resolve')
  resolve(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ResolvePersonnelProposalDto,
  ) {
    return this.personnelProposalsService.resolve(tenantId, id, user.userId, dto);
  }
}

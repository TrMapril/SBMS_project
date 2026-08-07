import { Controller, Get, Param } from '@nestjs/common';
import { PublicService } from './public.service';

/** Không gắn JwtAuthGuard/TenantInterceptor ở đây — đúng Mục "Phạm vi" Giai đoạn 7 plan.md:
 * "API public không cần JWT". */
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('tenant/:slug')
  getTenant(@Param('slug') slug: string) {
    return this.publicService.getTenantLandingPage(slug);
  }
}

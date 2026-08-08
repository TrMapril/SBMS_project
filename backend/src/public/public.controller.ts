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

  // Đặt TRƯỚC 'tenant/:slug/blog/:postSlug' theo thứ tự khai báo không quan trọng ở đây (2 path
  // pattern không trùng khả năng khớp), nhưng vẫn theo đúng quy ước "route cụ thể trước route
  // tổng quát" đã dùng xuyên suốt dự án.
  @Get('tenant/:slug/posts')
  listPosts(@Param('slug') slug: string) {
    return this.publicService.listPosts(slug);
  }

  @Get('tenant/:slug/posts/:postSlug')
  getPost(@Param('slug') slug: string, @Param('postSlug') postSlug: string) {
    return this.publicService.getPost(slug, postSlug);
  }
}

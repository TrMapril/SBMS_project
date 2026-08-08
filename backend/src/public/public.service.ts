import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  /** Endpoint công khai, KHÔNG qua JWT — chỉ trả đúng các field phục vụ trang giới thiệu doanh
   * nghiệp (Mục 4.8 tài liệu phân tích thiết kế), tuyệt đối không trả nguyên `tenant_config`
   * (sẽ lộ `assignmentWeights`/`enabledModules` — dữ liệu nội bộ không dành cho public). */
  async getTenantLandingPage(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      include: { config: true },
    });
    if (!tenant || !tenant.config) {
      throw new NotFoundException(
        'Không tìm thấy trang giới thiệu doanh nghiệp',
      );
    }

    const config = tenant.config;
    return {
      slug: tenant.slug,
      name: tenant.name,
      systemName: config.systemName,
      logoUrl: config.logoUrl,
      primaryColor: config.primaryColor,
      introText: config.introText,
      bannerImages: config.bannerImages,
      address: config.address,
      contactPhone: config.contactPhone,
      contactEmail: config.contactEmail,
      socialLinks: config.socialLinks,
      landingBackgroundColor: config.landingBackgroundColor,
      landingBackgroundImageUrl: config.landingBackgroundImageUrl,
    };
  }
}

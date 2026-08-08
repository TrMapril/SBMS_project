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

  /** Phase 7.5 Đợt 5 — chỉ trả bài viết ĐÃ XUẤT BẢN (`publishedAt` khác null), bài nháp không lộ
   * ra public dù biết đúng slug. Trả `excerpt` (160 ký tự đầu `content`) thay vì toàn bộ nội dung
   * cho danh sách dạng card — tiết kiệm băng thông, đọc đầy đủ ở trang chi tiết. */
  async listPosts(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) {
      throw new NotFoundException('Không tìm thấy doanh nghiệp này');
    }
    const posts = await this.prisma.tenantPost.findMany({
      where: { tenantId: tenant.id, publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        coverImageUrl: true,
        content: true,
        publishedAt: true,
      },
    });
    return posts.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      coverImageUrl: p.coverImageUrl,
      excerpt:
        p.content.length > 160 ? `${p.content.slice(0, 160)}...` : p.content,
      publishedAt: p.publishedAt,
    }));
  }

  async getPost(slug: string, postSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) {
      throw new NotFoundException('Không tìm thấy doanh nghiệp này');
    }
    const post = await this.prisma.tenantPost.findUnique({
      where: { tenantId_slug: { tenantId: tenant.id, slug: postSlug } },
    });
    if (!post || !post.publishedAt) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }
    return post;
  }
}

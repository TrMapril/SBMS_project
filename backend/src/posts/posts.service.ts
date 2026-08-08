import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { SupabaseStorageService } from '../common/storage/supabase-storage.service';
import { assertValidUpload } from '../common/utils/file-validation.util';
import { toSlug } from '../common/utils/slug.util';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

const COVER_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png'];

/**
 * Phase 7.5 Đợt 5 — module "Bài viết" cho trang giới thiệu doanh nghiệp (mở rộng có kiểm soát so
 * với Quyết định #9 CLAUDE.md, đã được người dùng xác nhận trước khi code — xem DECISIONS.md).
 * `content` là text thuần (không markdown/rich-text), `slug` sinh 1 lần lúc tạo và KHÔNG đổi lại
 * khi sửa title sau đó (giữ URL ổn định).
 */
@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: SupabaseStorageService,
  ) {}

  /** Đảm bảo slug duy nhất trong phạm vi tenant — cùng cách disambiguate bằng số thứ tự tăng dần
   * đã dùng cho email lúc tạo user hàng loạt (Đợt 2), áp dụng cho slug thay vì local-part email. */
  private async generateUniqueSlug(
    tenantId: string,
    title: string,
  ): Promise<string> {
    const base = toSlug(title);
    let slug = base;
    let suffix = 1;
    while (
      await this.prisma.tenantPost.findUnique({
        where: { tenantId_slug: { tenantId, slug } },
        select: { id: true },
      })
    ) {
      suffix += 1;
      slug = `${base}-${suffix}`;
    }
    return slug;
  }

  private resolvePublishedAt(
    currentPublishedAt: Date | null,
    published: boolean | undefined,
  ): Date | null | undefined {
    if (published === undefined) return undefined; // không đụng tới field này
    if (published === false) return null;
    return currentPublishedAt ?? new Date(); // true: giữ ngày xuất bản gốc nếu đã publish trước đó
  }

  async create(
    tenantId: string,
    dto: CreatePostDto,
    file?: Express.Multer.File,
  ) {
    const slug = await this.generateUniqueSlug(tenantId, dto.title);
    let coverImageUrl: string | undefined;
    if (file) {
      assertValidUpload(file, COVER_IMAGE_MIME_TYPES);
      coverImageUrl = await this.storage.upload(
        `tenant-posts/${tenantId}`,
        file,
      );
    }

    return this.prisma.tenantPost.create({
      data: {
        tenantId,
        title: dto.title,
        slug,
        content: dto.content,
        coverImageUrl,
        publishedAt: dto.published ? new Date() : null,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.tenantPost.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const post = await this.prisma.tenantPost.findFirst({
      where: { id, tenantId },
    });
    if (!post) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }
    return post;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdatePostDto,
    file?: Express.Multer.File,
  ) {
    const post = await this.findOne(tenantId, id);

    let coverImageUrl: string | undefined;
    if (file) {
      assertValidUpload(file, COVER_IMAGE_MIME_TYPES);
      coverImageUrl = await this.storage.upload(
        `tenant-posts/${tenantId}`,
        file,
      );
      if (post.coverImageUrl) {
        await this.storage.remove(post.coverImageUrl);
      }
    }

    return this.prisma.tenantPost.update({
      where: { id },
      data: {
        title: dto.title,
        content: dto.content,
        coverImageUrl,
        publishedAt: this.resolvePublishedAt(post.publishedAt, dto.published),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const post = await this.findOne(tenantId, id);
    if (post.coverImageUrl) {
      await this.storage.remove(post.coverImageUrl);
    }
    await this.prisma.tenantPost.delete({ where: { id } });
    return { id };
  }
}

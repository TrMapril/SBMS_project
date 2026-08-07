import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Prisma, TenantConfig } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { SupabaseStorageService } from '../common/storage/supabase-storage.service';
import { assertValidUpload, UploadedFileLike } from '../common/utils/file-validation.util';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateTenantConfigDto } from './dto/update-tenant-config.dto';

const BANNER_IMAGE_MAX_COUNT = 5;
const BANNER_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png'];

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly storage: SupabaseStorageService,
  ) {}

  private configCacheKey(tenantId: string): string {
    return `tenant-config:${tenantId}`;
  }

  /** Admin của tenant tự xem/sửa Settings (theme, module bật/tắt) — khác với CRUD tenant ở
   * trên vốn chỉ Super Admin dùng để quản lý toàn bộ tenant trong hệ thống. Cache in-memory,
   * không TTL (Mục 3.8 CLAUDE.md) — `updateMyConfig` invalidate ngay khi Admin lưu Settings. */
  async getMyConfig(tenantId: string) {
    const cacheKey = this.configCacheKey(tenantId);
    const cached = await this.cache.get<TenantConfig>(cacheKey);
    if (cached) return cached;

    const config = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
    });
    if (!config) {
      throw new NotFoundException('Không tìm thấy tenant_config');
    }
    await this.cache.set(cacheKey, config);
    return config;
  }

  async updateMyConfig(tenantId: string, dto: UpdateTenantConfigDto) {
    await this.getMyConfig(tenantId);
    const updated = await this.prisma.tenantConfig.update({
      where: { tenantId },
      data: {
        ...dto,
        assignmentWeights: dto.assignmentWeights
          ? { ...dto.assignmentWeights }
          : undefined,
        socialLinks: dto.socialLinks ? { ...dto.socialLinks } : undefined,
      },
    });
    await this.cache.del(this.configCacheKey(tenantId));
    return updated;
  }

  /** Thêm 1 ảnh vào bannerImages — giới hạn tối đa 5 ảnh (Mục "Definition of Done" Giai đoạn 7
   * plan.md: "upload ảnh thứ 6 bị từ chối với thông báo rõ ràng"), kiểm tra ngay tại thời điểm
   * upload (không phải ràng buộc DB) vì mảng lưu dạng Json, không có CHECK constraint được. */
  async addBannerImage(tenantId: string, file: UploadedFileLike & { originalname: string }) {
    assertValidUpload(file, BANNER_IMAGE_MIME_TYPES);
    const config = await this.getMyConfig(tenantId);
    const images = (config.bannerImages as string[]) ?? [];
    if (images.length >= BANNER_IMAGE_MAX_COUNT) {
      throw new BadRequestException(
        `Đã đạt giới hạn tối đa ${BANNER_IMAGE_MAX_COUNT} ảnh giới thiệu`,
      );
    }

    const url = await this.storage.upload(`tenant-banners/${tenantId}`, file);
    const updated = await this.prisma.tenantConfig.update({
      where: { tenantId },
      data: { bannerImages: [...images, url] },
    });
    await this.cache.del(this.configCacheKey(tenantId));
    return updated;
  }

  async removeBannerImage(tenantId: string, index: number) {
    const config = await this.getMyConfig(tenantId);
    const images = [...((config.bannerImages as string[]) ?? [])];
    if (index < 0 || index >= images.length) {
      throw new NotFoundException('Không tìm thấy ảnh ở vị trí này');
    }

    const [removedUrl] = images.splice(index, 1);
    await this.storage.remove(removedUrl);
    const updated = await this.prisma.tenantConfig.update({
      where: { tenantId },
      data: { bannerImages: images },
    });
    await this.cache.del(this.configCacheKey(tenantId));
    return updated;
  }

  async create(dto: CreateTenantDto) {
    try {
      return await this.prisma.tenant.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          config: { create: {} },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('slug tenant đã tồn tại');
      }
      throw error;
    }
  }

  async findAll(pagination: PaginationQueryDto) {
    const { page, limit } = pagination;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.tenant.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tenant.count(),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Không tìm thấy tenant');
    }
    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.findOne(id);
    try {
      return await this.prisma.tenant.update({ where: { id }, data: dto });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('slug tenant đã tồn tại');
      }
      throw error;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    const userCount = await this.prisma.user.count({
      where: { tenantId: id },
    });
    if (userCount > 0) {
      throw new BadRequestException(
        'Không thể xoá tenant đang có user, hãy xoá user trước',
      );
    }
    await this.prisma.tenant.delete({ where: { id } });
    return { id };
  }
}

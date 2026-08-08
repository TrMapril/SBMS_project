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
import {
  assertValidUpload,
  UploadedFileLike,
} from '../common/utils/file-validation.util';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateTenantConfigDto } from './dto/update-tenant-config.dto';
import { UpdateMaxEmployeesDto } from './dto/update-max-employees.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';

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
  async addBannerImage(
    tenantId: string,
    file: UploadedFileLike & { originalname: string },
  ) {
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

  /** Phase 7.5 Đợt 1 mục F — CHỈ Super Admin gọi được (route riêng, không đi qua
   * PATCH /tenants/me/config vốn Admin tenant tự sửa). tenant_config đang cache (Mục 3.8
   * CLAUDE.md) nên phải invalidate ngay dù sửa qua đường khác với updateMyConfig. */
  async updateMaxEmployees(tenantId: string, dto: UpdateMaxEmployeesDto) {
    await this.getMyConfig(tenantId);
    const updated = await this.prisma.tenantConfig.update({
      where: { tenantId },
      data: { maxEmployees: dto.maxEmployees },
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

  /** Phase 7.5 Đợt 4 — "Trang quản lý doanh nghiệp" cần số liệu nhanh/tenant: số user hiện tại/
   * giới hạn, số project, lần hoạt động gần nhất. Số tenant trong 1 hệ thống ở quy mô đồ án rất
   * nhỏ (không phân trang sâu) nên tính bằng vòng lặp `Promise.all` mỗi trang thay vì 1 raw query
   * gộp phức tạp — đơn giản nhất theo Mục 8 CLAUDE.md, chấp nhận không tối ưu N+1 ở quy mô lớn.
   * "Hoạt động gần nhất" lấy `MAX(tasks.updated_at)` của tenant — đại diện cho hành động nghiệp vụ
   * thật (transition/report done/...), không dùng `users.updated_at` vì cột đó đổi cả khi chỉ sửa
   * hồ sơ, không phản ánh "tenant có đang hoạt động" rõ bằng Task. */
  async findAll(pagination: PaginationQueryDto) {
    const { page, limit } = pagination;
    const [tenants, total] = await this.prisma.$transaction([
      this.prisma.tenant.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { config: { select: { maxEmployees: true } } },
      }),
      this.prisma.tenant.count(),
    ]);

    const data = await Promise.all(
      tenants.map(async (tenant) => {
        const [userCount, projectCount, lastTask] = await Promise.all([
          this.prisma.user.count({ where: { tenantId: tenant.id } }),
          this.prisma.project.count({ where: { tenantId: tenant.id } }),
          this.prisma.task.findFirst({
            where: { tenantId: tenant.id },
            orderBy: { updatedAt: 'desc' },
            select: { updatedAt: true },
          }),
        ]);
        const { config, ...tenantFields } = tenant;
        return {
          ...tenantFields,
          userCount,
          maxEmployees: config?.maxEmployees ?? null,
          projectCount,
          lastActivityAt: lastTask?.updatedAt ?? null,
        };
      }),
    );

    return { data, total, page, limit };
  }

  /** Dashboard Super Admin — số liệu toàn hệ thống, không tính Super Admin vào `totalUsers` (họ
   * không thuộc tenant nào, đếm vào sẽ gây hiểu nhầm "user của tenant"). */
  async getStatsOverview() {
    const [totalTenants, totalUsers, totalProjects, tenants] =
      await Promise.all([
        this.prisma.tenant.count(),
        this.prisma.user.count({ where: { tenantId: { not: null } } }),
        this.prisma.project.count(),
        this.prisma.tenant.findMany({ select: { createdAt: true } }),
      ]);

    // Tuỳ chọn "biểu đồ tenant mới theo thời gian" — gộp theo tháng (YYYY-MM) từ createdAt sẵn có,
    // tính trong JS thay vì raw SQL date_trunc vì số tenant nhỏ ở quy mô đồ án.
    const byMonth = new Map<string, number>();
    for (const t of tenants) {
      const key = t.createdAt.toISOString().slice(0, 7);
      byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
    }
    const newTenantsByMonth = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));

    return { totalTenants, totalUsers, totalProjects, newTenantsByMonth };
  }

  /** Phase 7.5 Đợt 4 — vô hiệu hoá chặn TOÀN BỘ user trong tenant đăng nhập (kiểm tra ở
   * AuthService.login), không xoá dữ liệu, không cần thêm ràng buộc nào ở đây. */
  async updateStatus(id: string, dto: UpdateTenantStatusDto) {
    await this.findOne(id);
    return this.prisma.tenant.update({
      where: { id },
      data: { isDisabled: dto.isDisabled },
    });
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

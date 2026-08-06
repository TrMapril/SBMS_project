import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateTenantConfigDto } from './dto/update-tenant-config.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Admin của tenant tự xem/sửa Settings (theme, module bật/tắt) — khác với CRUD tenant ở
   * trên vốn chỉ Super Admin dùng để quản lý toàn bộ tenant trong hệ thống. */
  async getMyConfig(tenantId: string) {
    const config = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
    });
    if (!config) {
      throw new NotFoundException('Không tìm thấy tenant_config');
    }
    return config;
  }

  async updateMyConfig(tenantId: string, dto: UpdateTenantConfigDto) {
    await this.getMyConfig(tenantId);
    return this.prisma.tenantConfig.update({
      where: { tenantId },
      data: dto,
    });
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

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateRoleDto) {
    try {
      return await this.prisma.role.create({
        data: { tenantId, name: dto.name, description: dto.description },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Tên Custom Role đã tồn tại trong tenant');
      }
      throw error;
    }
  }

  async findAll(tenantId: string, pagination: PaginationQueryDto) {
    const { page, limit } = pagination;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.role.findMany({
        where: { tenantId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.role.count({ where: { tenantId } }),
    ]);
    return { data, total, page, limit };
  }

  /** Custom Role của chính user gọi — dùng để FE tự xét ẩn/hiện nút Transition theo quyền. */
  async findMyRoles(tenantId: string, userId: string) {
    return this.findRolesForUser(tenantId, userId);
  }

  /** Phase 7.5 Đợt 2 — Admin xem Custom Role hiện tại của 1 Employee bất kỳ (tính năng "Đổi
   * Custom Role" ở trang User) — khác `findMyRoles` vốn chỉ trả về của chính user gọi. */
  async findRolesForUser(tenantId: string, userId: string) {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId, role: { tenantId } },
      include: { role: true },
    });
    return userRoles.map((ur) => ur.role);
  }

  async findOne(tenantId: string, id: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId },
      include: {
        userRoles: {
          include: {
            user: {
              select: { id: true, email: true, fullName: true, systemRole: true },
            },
          },
        },
      },
    });
    if (!role) {
      throw new NotFoundException('Không tìm thấy Custom Role');
    }
    return role;
  }

  async update(tenantId: string, id: string, dto: UpdateRoleDto) {
    await this.findOne(tenantId, id);
    try {
      return await this.prisma.role.update({ where: { id }, data: dto });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Tên Custom Role đã tồn tại trong tenant');
      }
      throw error;
    }
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    const assignedCount = await this.prisma.userRole.count({
      where: { roleId: id },
    });
    if (assignedCount > 0) {
      throw new BadRequestException(
        'Không thể xoá Custom Role đang được gán cho user',
      );
    }
    await this.prisma.role.delete({ where: { id } });
    return { id };
  }

  async assignUser(tenantId: string, roleId: string, dto: AssignRoleDto) {
    await this.findOne(tenantId, roleId);
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, tenantId },
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy user trong tenant');
    }

    try {
      return await this.prisma.userRole.create({
        data: { roleId, userId: dto.userId },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('User đã được gán Custom Role này');
      }
      throw error;
    }
  }

  async unassignUser(tenantId: string, roleId: string, userId: string) {
    await this.findOne(tenantId, roleId);
    const userRole = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
    });
    if (!userRole) {
      throw new NotFoundException('User chưa được gán Custom Role này');
    }
    await this.prisma.userRole.delete({ where: { id: userRole.id } });
    return { id: userRole.id };
  }
}

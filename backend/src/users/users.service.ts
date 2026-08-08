import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { toPublicUser } from '../common/utils/public-user.util';
import { generateTempPassword } from '../common/utils/generate-temp-password.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Phase 7.5 Đợt 1 mục F + "Quyết định nền tảng" #1: enforce TRƯỚC khi tạo, đọc thẳng DB (không
   * qua cache tenant_config) vì đây không phải hot-path và tránh vòng phụ thuộc module ngược lại
   * TenantsModule (TenantsModule đã import UsersModule để bootstrap Admin đầu tiên).
   */
  private async assertCanCreateUser(tenantId: string, dto: CreateUserDto) {
    const config = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: { maxEmployees: true },
    });
    if (config?.maxEmployees != null) {
      const currentCount = await this.prisma.user.count({ where: { tenantId } });
      if (currentCount >= config.maxEmployees) {
        throw new BadRequestException(
          `Tenant đã đạt giới hạn tối đa ${config.maxEmployees} nhân sự`,
        );
      }
    }

    if (dto.systemRole === 'MANAGER') {
      const managerCount = await this.prisma.user.count({
        where: { tenantId, systemRole: 'MANAGER' },
      });
      if (managerCount > 0) {
        throw new BadRequestException(
          'Tenant đã có Manager — đổi role Manager hiện tại trước khi tạo Manager mới',
        );
      }
    }
  }

  async create(tenantId: string, dto: CreateUserDto) {
    await this.assertCanCreateUser(tenantId, dto);
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          tenantId,
          email: dto.email,
          fullName: dto.fullName,
          systemRole: dto.systemRole,
          passwordHash,
          mustChangePassword: true,
        },
      });
      return { user: toPublicUser(user), tempPassword };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email đã được sử dụng');
      }
      throw error;
    }
  }

  async findAll(tenantId: string, pagination: PaginationQueryDto) {
    const { page, limit } = pagination;
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: { tenantId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where: { tenantId } }),
    ]);
    return { data: users.map(toPublicUser), total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy user');
    }
    return toPublicUser(user);
  }

  async updateStatus(tenantId: string, id: string, dto: UpdateUserStatusDto) {
    await this.findOne(tenantId, id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
    });
    if (dto.status === 'LOCKED') {
      await this.notifyManagersIfActiveProjectMember(tenantId, updated.id, updated.fullName);
    }
    return toPublicUser(updated);
  }

  /** Phase 7.5 Đợt 1 mục C — Admin khoá 1 user đang là thành viên ACTIVE của ít nhất 1 project
   * ACTIVE → báo cho Manager (đúng "Quyết định nền tảng" #1: 1 tenant chỉ có đúng 1 Manager tại
   * 1 thời điểm, nên không cần tra "Manager của từng project cụ thể" — luôn là chính Manager duy
   * nhất của tenant). Không throw nếu không có project nào bị ảnh hưởng — im lặng bỏ qua. */
  private async notifyManagersIfActiveProjectMember(
    tenantId: string,
    lockedUserId: string,
    lockedUserFullName: string,
  ) {
    const affectedMembership = await this.prisma.projectMember.findFirst({
      where: {
        userId: lockedUserId,
        status: 'ACTIVE',
        project: { tenantId, status: 'ACTIVE' },
      },
    });
    if (!affectedMembership) return;

    const managers = await this.prisma.user.findMany({
      where: { tenantId, systemRole: 'MANAGER' },
      select: { id: true },
    });
    for (const manager of managers) {
      await this.notifications.notify(tenantId, manager.id, 'project-member:locked', {
        userId: lockedUserId,
        userFullName: lockedUserFullName,
      });
    }
  }
}

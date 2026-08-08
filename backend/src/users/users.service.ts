import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { toPublicUser } from '../common/utils/public-user.util';
import { generateTempPassword } from '../common/utils/generate-temp-password.util';
import { toUsernameLocalPart } from '../common/utils/username.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { BulkCreateUsersDto } from './dto/bulk-create-users.dto';
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
   * TenantsModule (TenantsModule đã import UsersModule để bootstrap Admin đầu tiên). Dùng chung
   * cho tạo 1 user (`create`) và tạo hàng loạt (`createBulk`, `additionalCount` = số user sẽ tạo
   * thêm trong cùng lượt).
   */
  private async assertMaxEmployeesNotExceeded(tenantId: string, additionalCount: number) {
    const config = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: { maxEmployees: true },
    });
    if (config?.maxEmployees == null) return;

    const currentCount = await this.prisma.user.count({ where: { tenantId } });
    if (currentCount + additionalCount > config.maxEmployees) {
      throw new BadRequestException(
        `Tenant đã có ${currentCount}/${config.maxEmployees} nhân sự, không thể tạo thêm ` +
          `${additionalCount} user (vượt quá ${currentCount + additionalCount - config.maxEmployees})`,
      );
    }
  }

  private async assertCanCreateUser(tenantId: string, dto: CreateUserDto) {
    await this.assertMaxEmployeesNotExceeded(tenantId, 1);

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

  /**
   * Phase 7.5 Đợt 2 — Admin thêm nhiều Employee cùng lúc. Tất cả-hoặc-không-gì: nếu vượt
   * `maxEmployees` thì chặn TOÀN BỘ lượt (không tạo phần vượt lẫn phần chưa vượt) — cách đơn giản
   * nhất phase_7_5.md cho phép, tránh phải xử lý "tạo được bao nhiêu thì dừng" theo thứ tự nào.
   * Email tự sinh dạng `<họ tên không dấu><số thứ tự nếu trùng>@<tenant-slug>.local`, đếm số thứ
   * tự trong phạm vi tenant (không phải toàn hệ thống) dù cột `email` unique toàn hệ thống — dùng
   * `$transaction` để rollback toàn bộ nếu 1 dòng nào đó xung đột email (P2002) giữa lúc tạo.
   */
  async createBulk(tenantId: string, dto: BulkCreateUsersDto) {
    await this.assertMaxEmployeesNotExceeded(tenantId, dto.rows.length);

    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const domain = `${tenant.slug}.local`;

    const roleIds = [...new Set(dto.rows.map((r) => r.roleId).filter((id): id is string => !!id))];
    if (roleIds.length > 0) {
      const roleCount = await this.prisma.role.count({ where: { id: { in: roleIds }, tenantId } });
      if (roleCount !== roleIds.length) {
        throw new BadRequestException('Có Custom Role không thuộc tenant trong danh sách');
      }
    }

    const existingEmails = new Set(
      (
        await this.prisma.user.findMany({
          where: { email: { endsWith: `@${domain}` } },
          select: { email: true },
        })
      ).map((u) => u.email.toLowerCase()),
    );

    const planned: { email: string; fullName: string; tempPassword: string; roleId?: string }[] =
      [];
    const usedLocalPartCounts = new Map<string, number>();

    for (const row of dto.rows) {
      const base = toUsernameLocalPart(row.fullName);
      let email: string;
      do {
        const nextIndex = (usedLocalPartCounts.get(base) ?? 0) + 1;
        usedLocalPartCounts.set(base, nextIndex);
        const localPart = nextIndex === 1 ? base : `${base}${nextIndex}`;
        email = `${localPart}@${domain}`;
      } while (existingEmails.has(email.toLowerCase()));
      existingEmails.add(email.toLowerCase());

      planned.push({
        email,
        fullName: row.fullName,
        tempPassword: generateTempPassword(),
        roleId: row.roleId,
      });
    }

    // Tạo thật toàn bộ trong 1 transaction duy nhất (đúng "tất cả-hoặc-không-gì" — nếu 1 dòng lỗi,
    // rollback toàn bộ, không để lại user tạo dở).
    try {
      await this.prisma.$transaction(async (tx) => {
        for (const row of planned) {
          const passwordHash = await bcrypt.hash(row.tempPassword, 10);
          const user = await tx.user.create({
            data: {
              tenantId,
              email: row.email,
              fullName: row.fullName,
              systemRole: 'EMPLOYEE',
              passwordHash,
              mustChangePassword: true,
            },
          });
          if (row.roleId) {
            await tx.userRole.create({ data: { userId: user.id, roleId: row.roleId } });
          }
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'Trùng email khi tạo hàng loạt, thử lại (có thể do 2 lượt tạo cùng lúc)',
        );
      }
      throw error;
    }

    return { users: planned.map(({ email, fullName, tempPassword }) => ({ email, fullName, tempPassword })) };
  }

  /** Phase 7.5 Đợt 2 — Trang User đổi sang dạng bảng, cần thêm Custom Role (chỉ có ý nghĩa với
   * Employee) + tìm kiếm theo họ tên/email + lọc theo trạng thái/vai trò hệ thống. */
  async findAll(tenantId: string, query: ListUsersQueryDto) {
    const { page, limit, search, status, systemRole } = query;
    const where: Prisma.UserWhereInput = {
      tenantId,
      ...(status ? { status } : {}),
      ...(systemRole ? { systemRole } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { userRoles: { include: { role: { select: { id: true, name: true } } } } },
      }),
      this.prisma.user.count({ where }),
    ]);
    const data = users.map((u) => {
      const { userRoles, ...rest } = u;
      return {
        ...toPublicUser(rest),
        customRoles: u.systemRole === 'EMPLOYEE' ? userRoles.map((ur) => ur.role) : [],
      };
    });
    return { data, total, page, limit };
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

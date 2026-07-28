import {
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

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateUserDto) {
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
    return toPublicUser(updated);
  }
}

import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma/prisma.service';
import { JwtPayload } from '../common/types/jwt-payload.type';
import { toPublicUser } from '../common/utils/public-user.util';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    if (user.status === 'LOCKED') {
      throw new ForbiddenException('Tài khoản đã bị khoá');
    }

    // Phase 7.5 Đợt 4 — Super Admin vô hiệu hoá tenant chặn TOÀN BỘ user trong tenant đăng nhập.
    // Super Admin có tenantId = null nên bỏ qua kiểm tra này với chính họ. Query riêng (thay vì
    // include ngay trong findUnique ở trên) để không phải trộn thêm field `tenant` vào object
    // `user` truyền cho `toPublicUser()` bên dưới.
    if (user.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { isDisabled: true },
      });
      if (tenant?.isDisabled) {
        throw new ForbiddenException('Doanh nghiệp của bạn đã bị vô hiệu hoá');
      }
    }

    const payload: JwtPayload = {
      userId: user.id,
      tenantId: user.tenantId,
      systemRole: user.systemRole,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: toPublicUser(user),
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }

    const currentMatches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!currentMatches) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });

    return toPublicUser(updated);
  }
}

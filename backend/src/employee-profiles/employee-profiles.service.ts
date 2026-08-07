import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { TaskHistoryAnalyticsService } from '../algorithms/task-history-analytics.service';
import { UpdateEmployeeProfileDto } from './dto/update-employee-profile.dto';

/**
 * Hồ sơ CÔNG KHAI nhân viên (Mục "Phạm vi" Giai đoạn 7 plan.md) — khác hẳn `competency_profiles`
 * nội bộ (chỉ Manager/Admin xem). Mọi user trong tenant xem được bản này của bất kỳ ai.
 * `completedTaskCount` tính trực tiếp từ task_history mỗi lần đọc (tái dùng
 * TaskHistoryAnalyticsService của Giai đoạn 5), không lưu trùng.
 */
@Injectable()
export class EmployeeProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: TaskHistoryAnalyticsService,
  ) {}

  async getPublicProfile(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true, fullName: true, email: true, systemRole: true },
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy nhân viên trong tenant');
    }

    const [profile, metrics] = await Promise.all([
      this.prisma.employeeProfile.findUnique({ where: { userId } }),
      this.analytics.getEmployeeMetrics(tenantId, userId),
    ]);

    return {
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      systemRole: user.systemRole,
      phone: profile?.phone ?? null,
      address: profile?.address ?? null,
      bio: profile?.bio ?? null,
      certifications: profile?.certifications ?? [],
      completedTaskCount: metrics.totalCompletedTasks,
    };
  }

  /** Upsert — chưa có row (chưa từng tự sửa hồ sơ lần nào) thì tạo mới ngay lần PATCH đầu tiên,
   * không cần bước "khởi tạo hồ sơ" riêng (cùng cách TenantConfig xử lý ở Giai đoạn 1/4). */
  async updateMyProfile(tenantId: string, userId: string, dto: UpdateEmployeeProfileDto) {
    return this.prisma.employeeProfile.upsert({
      where: { userId },
      create: {
        tenantId,
        userId,
        phone: dto.phone,
        address: dto.address,
        bio: dto.bio,
        certifications: dto.certifications
          ? dto.certifications.map((c) => ({ ...c }))
          : [],
      },
      update: {
        phone: dto.phone,
        address: dto.address,
        bio: dto.bio,
        certifications: dto.certifications
          ? dto.certifications.map((c) => ({ ...c }))
          : undefined,
      },
    });
  }
}

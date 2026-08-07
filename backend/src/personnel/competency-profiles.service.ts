import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { TaskHistoryAnalyticsService } from '../algorithms/task-history-analytics.service';
import { CreateCompetencyProfileDto } from './dto/create-competency-profile.dto';

/**
 * Hồ sơ năng lực NỘI BỘ (Mục 4.3 tài liệu phân tích thiết kế) — chỉ Manager/Admin xem
 * (`@Roles('MANAGER','ADMIN')` ở Controller), khác hẳn `EmployeeProfilesService` công khai.
 */
@Injectable()
export class CompetencyProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: TaskHistoryAnalyticsService,
  ) {}

  async getProfile(tenantId: string, userId: string) {
    await this.assertUserInTenant(tenantId, userId);
    const [autoMetrics, entries] = await Promise.all([
      this.analytics.getEmployeeMetrics(tenantId, userId),
      this.prisma.competencyProfile.findMany({
        where: { tenantId, userId },
        orderBy: { createdAt: 'desc' },
        include: { createdByUser: { select: { id: true, fullName: true } } },
      }),
    ]);
    return { autoMetrics, entries };
  }

  async createEntry(tenantId: string, createdBy: string, dto: CreateCompetencyProfileDto) {
    await this.assertUserInTenant(tenantId, dto.userId);
    return this.prisma.competencyProfile.create({
      data: {
        tenantId,
        userId: dto.userId,
        periodLabel: dto.periodLabel,
        overallRating: dto.overallRating,
        managerNotes: dto.managerNotes,
        createdBy,
      },
    });
  }

  private async assertUserInTenant(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy nhân viên trong tenant');
    }
  }
}

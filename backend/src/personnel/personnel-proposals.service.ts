import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreatePersonnelProposalDto } from './dto/create-personnel-proposal.dto';
import { ResolvePersonnelProposalDto } from './dto/resolve-personnel-proposal.dto';
import { ListPersonnelProposalsQueryDto } from './dto/list-personnel-proposals-query.dto';
import type { JwtPayload } from '../common/types/jwt-payload.type';

/**
 * Đề xuất nhân sự (Mục 4.3 tài liệu phân tích thiết kế): Manager tạo, Admin phê duyệt/từ chối.
 * Quy trình 1 bước duy nhất — đúng "mức tối giản" plan.md cho phép, KHÔNG phải bị cắt bớt từ quy
 * trình nhiều bước nào (tài liệu gốc vốn dĩ chỉ mô tả 1 bước phê duyệt). Không bắn notification
 * khi resolve — Mục "Quy ước Socket.io" plan.md chỉ liệt kê đúng 4 event cố định, không có
 * event nào cho personnel_proposals; không tự thêm event ngoài danh sách đã chốt.
 */
@Injectable()
export class PersonnelProposalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, proposedBy: string, dto: CreatePersonnelProposalDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, tenantId },
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy nhân viên trong tenant');
    }
    return this.prisma.personnelProposal.create({
      data: {
        tenantId,
        userId: dto.userId,
        type: dto.type,
        description: dto.description,
        proposedBy,
      },
    });
  }

  async findAll(
    tenantId: string,
    requester: JwtPayload,
    query: ListPersonnelProposalsQueryDto,
  ) {
    const { page, limit, status } = query;
    const isAdmin = requester.systemRole === 'ADMIN';
    const where = {
      tenantId,
      ...(status ? { status } : {}),
      ...(isAdmin ? {} : { proposedBy: requester.userId }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.personnelProposal.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, fullName: true } },
          proposedByUser: { select: { id: true, fullName: true } },
          reviewer: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.personnelProposal.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async resolve(
    tenantId: string,
    id: string,
    reviewerId: string,
    dto: ResolvePersonnelProposalDto,
  ) {
    const proposal = await this.prisma.personnelProposal.findFirst({
      where: { id, tenantId },
    });
    if (!proposal) {
      throw new NotFoundException('Không tìm thấy đề xuất nhân sự');
    }
    if (proposal.status !== 'PENDING') {
      throw new BadRequestException('Đề xuất này đã được xử lý trước đó');
    }

    return this.prisma.personnelProposal.update({
      where: { id },
      data: {
        status: dto.status,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewComment: dto.comment ?? null,
      },
    });
  }
}

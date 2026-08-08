import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateRequestTypeDto, RequestTypeFieldDto } from './dto/create-request-type.dto';

@Injectable()
export class RequestTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateRequestTypeDto) {
    try {
      return await this.prisma.requestTypeTemplate.create({
        data: {
          tenantId,
          name: dto.name,
          fields: dto.fields.map((f) => ({ ...f })),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Tên loại đơn đã tồn tại trong tenant');
      }
      throw error;
    }
  }

  /** Mở cho mọi thành viên tenant — Employee/Admin cần đọc để chọn loại đơn khi gửi đơn. */
  async findAll(tenantId: string) {
    return this.prisma.requestTypeTemplate.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const template = await this.prisma.requestTypeTemplate.findFirst({
      where: { id, tenantId },
    });
    if (!template) {
      throw new NotFoundException('Không tìm thấy loại đơn');
    }
    return template;
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    const usedCount = await this.prisma.leaveRequest.count({
      where: { requestTypeId: id },
    });
    if (usedCount > 0) {
      throw new BadRequestException(
        'Không thể xoá loại đơn đã có đơn từ nào gửi theo loại này',
      );
    }
    await this.prisma.requestTypeTemplate.delete({ where: { id } });
    return { id };
  }

  /** Dùng bởi LeaveRequestsService khi tạo đơn `type = CUSTOM` — validate đủ field `required`,
   * không ép kiểu dữ liệu (Mục 3.5/3.6 CLAUDE.md). */
  validateCustomFieldValues(
    fields: RequestTypeFieldDto[],
    values: Record<string, unknown> | undefined,
  ): Record<string, string> {
    const raw = values ?? {};
    const result: Record<string, string> = {};
    for (const field of fields) {
      const value = raw[field.key];
      const text = value == null ? '' : String(value);
      if (field.required && text.trim().length === 0) {
        throw new BadRequestException(`Thiếu trường bắt buộc: ${field.label}`);
      }
      if (text.length > 0) {
        result[field.key] = text;
      }
    }
    return result;
  }
}

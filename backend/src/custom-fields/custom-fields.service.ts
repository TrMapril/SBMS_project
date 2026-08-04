import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomField, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';
import { UpdateCustomFieldDto } from './dto/update-custom-field.dto';

@Injectable()
export class CustomFieldsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateCustomFieldDto) {
    try {
      return await this.prisma.customField.create({
        data: {
          tenantId,
          name: dto.name,
          fieldType: dto.fieldType,
          isRequired: dto.isRequired ?? false,
          defaultValue: dto.defaultValue,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Tên Custom Field đã tồn tại trong tenant');
      }
      throw error;
    }
  }

  async findAll(tenantId: string, pagination: PaginationQueryDto) {
    const { page, limit } = pagination;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.customField.findMany({
        where: { tenantId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customField.count({ where: { tenantId } }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const field = await this.prisma.customField.findFirst({
      where: { id, tenantId },
    });
    if (!field) {
      throw new NotFoundException('Không tìm thấy Custom Field');
    }
    return field;
  }

  async update(tenantId: string, id: string, dto: UpdateCustomFieldDto) {
    await this.findOne(tenantId, id);
    try {
      return await this.prisma.customField.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Tên Custom Field đã tồn tại trong tenant');
      }
      throw error;
    }
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    const usedCount = await this.prisma.customFieldValue.count({
      where: { customFieldId: id },
    });
    if (usedCount > 0) {
      throw new BadRequestException(
        'Không thể xoá Custom Field đã có giá trị gán cho Task',
      );
    }
    await this.prisma.customField.delete({ where: { id } });
    return { id };
  }

  /**
   * Chuẩn hoá 1 giá trị thô về dạng text lưu trong custom_field_values, validate đúng kiểu
   * fieldType (Mục 3.5 CLAUDE.md: chỉ validate kiểu dữ liệu đơn giản, không xây rule engine).
   */
  normalizeValue(field: CustomField, raw: unknown): string {
    switch (field.fieldType) {
      case 'NUMBER': {
        const num = typeof raw === 'number' ? raw : Number(raw);
        if (
          raw === '' ||
          raw === null ||
          raw === undefined ||
          Number.isNaN(num)
        ) {
          throw new BadRequestException(
            `Custom Field "${field.name}" phải là số`,
          );
        }
        return String(num);
      }
      case 'BOOLEAN': {
        if (raw === true || raw === 'true') return 'true';
        if (raw === false || raw === 'false') return 'false';
        throw new BadRequestException(
          `Custom Field "${field.name}" phải là true/false`,
        );
      }
      case 'DATE': {
        const date = new Date(raw as string);
        if (Number.isNaN(date.getTime())) {
          throw new BadRequestException(
            `Custom Field "${field.name}" phải là ngày hợp lệ`,
          );
        }
        return date.toISOString();
      }
      case 'TEXT':
      default:
        return String(raw);
    }
  }

  /**
   * Validate + chuẩn hoá 1 map { customFieldId: rawValue } gửi từ client, dùng chung cho cả
   * tạo Task và gán custom field values cho Task đã có (module tasks gọi vào đây).
   */
  async validateAndNormalizeValues(
    tenantId: string,
    rawValues: Record<string, unknown>,
  ): Promise<{ customFieldId: string; value: string }[]> {
    const fieldIds = Object.keys(rawValues);
    if (fieldIds.length === 0) return [];

    const fields = await this.prisma.customField.findMany({
      where: { id: { in: fieldIds }, tenantId },
    });
    const fieldById = new Map(fields.map((f) => [f.id, f]));

    const invalidIds = fieldIds.filter((id) => !fieldById.has(id));
    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `Custom Field không tồn tại trong tenant: ${invalidIds.join(', ')}`,
      );
    }

    return fieldIds.map((customFieldId) => {
      const field = fieldById.get(customFieldId)!;
      return {
        customFieldId,
        value: this.normalizeValue(field, rawValues[customFieldId]),
      };
    });
  }
}

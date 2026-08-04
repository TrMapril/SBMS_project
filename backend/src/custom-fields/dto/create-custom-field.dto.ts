import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { CustomFieldType } from '@prisma/client';

const FIELD_TYPES: CustomFieldType[] = ['TEXT', 'NUMBER', 'DATE', 'BOOLEAN'];

export class CreateCustomFieldDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsIn(FIELD_TYPES)
  fieldType: CustomFieldType;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsString()
  defaultValue?: string;
}

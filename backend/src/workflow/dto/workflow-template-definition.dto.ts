import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TransitionConditionDto } from './transition-condition.dto';

/** Phase 7.5 Đợt 5 mục 6 — validate `definition` khi Super Admin CRUD Workflow Template qua UI,
 * cùng phong cách nested DTO đã dùng cho Workflow thật (`CreateWorkflowTransitionDto`), khác hẳn
 * lúc import chỉ đọc snapshot JSON không qua validate (Đợt template đã tồn tại từ Giai đoạn 2). */
export class TemplateStateDto {
  @IsString()
  @MinLength(1)
  tempId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsBoolean()
  isStart?: boolean;

  @IsOptional()
  @IsBoolean()
  isEnd?: boolean;

  @IsOptional()
  @IsInt()
  orderIndex?: number;
}

export class TemplateTransitionDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  fromTempId: string;

  @IsString()
  @MinLength(1)
  toTempId: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TransitionConditionDto)
  condition?: TransitionConditionDto;
}

export class WorkflowTemplateDefinitionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateStateDto)
  states: TemplateStateDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateTransitionDto)
  transitions: TemplateTransitionDto[];
}

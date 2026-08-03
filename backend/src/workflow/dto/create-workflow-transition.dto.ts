import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TransitionConditionDto } from './transition-condition.dto';

export class CreateWorkflowTransitionDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsUUID()
  fromStateId: string;

  @IsUUID()
  toStateId: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  allowRoles?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => TransitionConditionDto)
  condition?: TransitionConditionDto;
}

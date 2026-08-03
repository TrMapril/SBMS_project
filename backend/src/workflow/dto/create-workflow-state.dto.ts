import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateWorkflowStateDto {
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

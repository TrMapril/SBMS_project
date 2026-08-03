import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class TransitionConditionDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requireCustomFields?: string[];

  @IsOptional()
  @IsBoolean()
  requireAssignee?: boolean;
}

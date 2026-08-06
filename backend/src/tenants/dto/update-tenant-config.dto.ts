import { IsArray, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AssignmentWeightsDto } from './assignment-weights.dto';

export class UpdateTenantConfigDto {
  @IsOptional()
  @IsString()
  systemName?: string;

  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledModules?: string[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AssignmentWeightsDto)
  assignmentWeights?: AssignmentWeightsDto;
}

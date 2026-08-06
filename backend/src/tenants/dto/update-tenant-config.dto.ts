import { IsArray, IsOptional, IsString } from 'class-validator';

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
}

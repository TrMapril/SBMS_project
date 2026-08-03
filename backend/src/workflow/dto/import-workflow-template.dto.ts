import { IsOptional, IsString, MinLength } from 'class-validator';

export class ImportWorkflowTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}

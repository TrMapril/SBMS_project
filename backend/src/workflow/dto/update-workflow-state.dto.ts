import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateWorkflowStateDto } from './create-workflow-state.dto';

export class UpdateWorkflowStateDto extends PartialType(
  CreateWorkflowStateDto,
) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

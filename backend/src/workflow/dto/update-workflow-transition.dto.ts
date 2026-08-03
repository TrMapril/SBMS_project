import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateWorkflowTransitionDto } from './create-workflow-transition.dto';

export class UpdateWorkflowTransitionDto extends PartialType(
  CreateWorkflowTransitionDto,
) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

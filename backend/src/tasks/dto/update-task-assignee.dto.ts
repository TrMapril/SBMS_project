import { IsUUID } from 'class-validator';

export class UpdateTaskAssigneeDto {
  @IsUUID()
  assigneeId: string;
}

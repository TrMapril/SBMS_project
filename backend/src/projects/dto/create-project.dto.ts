import { IsString, IsUUID, MinLength } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsUUID()
  workflowId: string;
}

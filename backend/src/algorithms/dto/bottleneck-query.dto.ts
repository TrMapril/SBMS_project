import { IsUUID } from 'class-validator';

export class BottleneckQueryDto {
  @IsUUID()
  workflowId: string;
}

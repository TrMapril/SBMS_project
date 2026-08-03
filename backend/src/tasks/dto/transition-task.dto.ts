import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class TransitionTaskDto {
  @IsUUID()
  transitionId: string;

  @IsInt()
  @Min(1)
  version: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

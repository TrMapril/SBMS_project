import { IsIn, IsOptional, IsString } from 'class-validator';

export class ResolveLeaveRequestDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  comment?: string;
}

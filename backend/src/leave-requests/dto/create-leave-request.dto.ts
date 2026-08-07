import { IsDateString, IsString, MinLength } from 'class-validator';

export class CreateLeaveRequestDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsString()
  @MinLength(1)
  reason: string;
}

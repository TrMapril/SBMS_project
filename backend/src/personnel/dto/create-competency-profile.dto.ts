import { IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';

export class CreateCompetencyProfileDto {
  @IsUUID()
  userId: string;

  @IsString()
  @MinLength(1)
  periodLabel: string;

  @IsInt()
  @Min(1)
  @Max(5)
  overallRating: number;

  @IsOptional()
  @IsString()
  managerNotes?: string;
}

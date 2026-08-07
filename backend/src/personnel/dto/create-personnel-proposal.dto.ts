import { IsIn, IsString, IsUUID, MinLength } from 'class-validator';

const PROPOSAL_TYPES = ['PROMOTION', 'RAISE', 'WARNING', 'AWARD'] as const;

export class CreatePersonnelProposalDto {
  @IsUUID()
  userId: string;

  @IsIn(PROPOSAL_TYPES)
  type: (typeof PROPOSAL_TYPES)[number];

  @IsString()
  @MinLength(1)
  description: string;
}

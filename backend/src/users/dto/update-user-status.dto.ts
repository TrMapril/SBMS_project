import { IsIn } from 'class-validator';

const TOGGLEABLE_STATUSES = ['ACTIVE', 'LOCKED'] as const;
export type ToggleableUserStatus = (typeof TOGGLEABLE_STATUSES)[number];

export class UpdateUserStatusDto {
  @IsIn(TOGGLEABLE_STATUSES)
  status: ToggleableUserStatus;
}

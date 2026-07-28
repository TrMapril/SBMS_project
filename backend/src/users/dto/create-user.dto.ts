import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';

const ASSIGNABLE_ROLES = ['ADMIN', 'MANAGER', 'EMPLOYEE'] as const;
export type AssignableSystemRole = (typeof ASSIGNABLE_ROLES)[number];

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  fullName: string;

  @IsIn(ASSIGNABLE_ROLES)
  systemRole: AssignableSystemRole;
}

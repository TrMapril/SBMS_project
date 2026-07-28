import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateTenantAdminDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  fullName: string;
}

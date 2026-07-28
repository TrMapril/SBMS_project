import { IsString, Matches, MinLength } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug phải dạng kebab-case (chữ thường, số, dấu gạch ngang)',
  })
  slug: string;
}

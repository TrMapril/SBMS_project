import { IsObject } from 'class-validator';

export class AssignCustomFieldValuesDto {
  @IsObject()
  values: Record<string, unknown>;
}

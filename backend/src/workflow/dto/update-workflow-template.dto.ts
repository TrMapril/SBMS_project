import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { WorkflowTemplateDefinitionDto } from './workflow-template-definition.dto';

export class UpdateWorkflowTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** Ghi đè TOÀN BỘ definition (states + transitions) — canvas builder gửi lại nguyên đồ thị sau
   * mỗi lần "Lưu", không có API chỉnh sửa từng phần tử riêng lẻ như Workflow thật (template không
   * có Task/Project tham chiếu nên không cần optimistic locking/audit trail cho từng thay đổi). */
  @IsOptional()
  @ValidateNested()
  @Type(() => WorkflowTemplateDefinitionDto)
  definition?: WorkflowTemplateDefinitionDto;
}

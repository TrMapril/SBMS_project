import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListLeaveRequestsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsIn(['LEAVE', 'TASK_RETURN'])
  type?: 'LEAVE' | 'TASK_RETURN';
}

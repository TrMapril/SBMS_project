import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AssignmentSuggestionService } from './assignment-suggestion.service';
import { RiskScoreService } from './risk-score.service';
import { BottleneckService } from './bottleneck.service';
import { AssignmentSuggestionQueryDto } from './dto/assignment-suggestion-query.dto';
import { RiskAlertsQueryDto } from './dto/risk-alerts-query.dto';
import { BottleneckQueryDto } from './dto/bottleneck-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantInterceptor } from '../common/interceptors/tenant.interceptor';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';

// Bộ ba thuật toán (Giai đoạn 5) đều là công cụ hỗ trợ Manager/Admin ra quyết định — không mở
// cho Employee (đúng tài liệu phân tích thiết kế Mục 4.4: "Khi Manager chọn assignee...",
// "Dashboard Manager"). Gợi ý phân công gắn với việc tạo Task nên thu hẹp về đúng Manager (Task
// chỉ do Manager tạo — Mục 3.2 quyết định ở Giai đoạn 4).
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
@Controller('algorithms')
export class AlgorithmsController {
  constructor(
    private readonly assignmentSuggestionService: AssignmentSuggestionService,
    private readonly riskScoreService: RiskScoreService,
    private readonly bottleneckService: BottleneckService,
  ) {}

  @Roles('MANAGER')
  @Get('assignment-suggestions')
  getAssignmentSuggestions(
    @CurrentTenant() tenantId: string,
    @Query() query: AssignmentSuggestionQueryDto,
  ) {
    return this.assignmentSuggestionService.getSuggestions(
      tenantId,
      query.projectId,
      query.currentStateId,
    );
  }

  @Roles('MANAGER', 'ADMIN')
  @Get('risk-alerts')
  getRiskAlerts(
    @CurrentTenant() tenantId: string,
    @Query() query: RiskAlertsQueryDto,
  ) {
    return this.riskScoreService.getRiskAlerts(tenantId, query.threshold);
  }

  /** Trigger thủ công — cron chạy mỗi giờ nên để test/demo không cần chờ, Admin/Manager có thể
   * gọi endpoint này để tính lại ngay (idempotent, không tạo dữ liệu trùng lặp). */
  @Roles('MANAGER', 'ADMIN')
  @Post('risk-alerts/recompute')
  recomputeRiskScores() {
    return this.riskScoreService.computeRiskScores();
  }

  @Roles('MANAGER', 'ADMIN')
  @Get('bottleneck-snapshots')
  getBottleneckSnapshot(
    @CurrentTenant() tenantId: string,
    @Query() query: BottleneckQueryDto,
  ) {
    return this.bottleneckService.getLatestSnapshot(tenantId, query.workflowId);
  }

  /** Trigger thủ công — cron chạy 1 lần/ngày nên để test/demo không cần chờ. */
  @Roles('MANAGER', 'ADMIN')
  @Post('bottleneck-snapshots/recompute')
  recomputeBottleneckSnapshot(
    @CurrentTenant() tenantId: string,
    @Query() query: BottleneckQueryDto,
  ) {
    return this.bottleneckService.computeSnapshotForWorkflow(
      tenantId,
      query.workflowId,
    );
  }
}

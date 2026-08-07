import { Module } from '@nestjs/common';
import { AlgorithmsController } from './algorithms.controller';
import { AssignmentSuggestionService } from './assignment-suggestion.service';
import { RiskScoreService } from './risk-score.service';
import { BottleneckService } from './bottleneck.service';
import { TaskHistoryAnalyticsService } from './task-history-analytics.service';
import { TenantsModule } from '../tenants/tenants.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TenantsModule, NotificationsModule],
  controllers: [AlgorithmsController],
  providers: [
    AssignmentSuggestionService,
    RiskScoreService,
    BottleneckService,
    TaskHistoryAnalyticsService,
  ],
  exports: [TaskHistoryAnalyticsService],
})
export class AlgorithmsModule {}

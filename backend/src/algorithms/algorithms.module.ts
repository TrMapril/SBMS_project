import { Module } from '@nestjs/common';
import { AlgorithmsController } from './algorithms.controller';
import { AssignmentSuggestionService } from './assignment-suggestion.service';
import { RiskScoreService } from './risk-score.service';
import { BottleneckService } from './bottleneck.service';
import { TaskHistoryAnalyticsService } from './task-history-analytics.service';

@Module({
  controllers: [AlgorithmsController],
  providers: [
    AssignmentSuggestionService,
    RiskScoreService,
    BottleneckService,
    TaskHistoryAnalyticsService,
  ],
})
export class AlgorithmsModule {}

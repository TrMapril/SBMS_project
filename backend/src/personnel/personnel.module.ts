import { Module } from '@nestjs/common';
import { CompetencyProfilesController } from './competency-profiles.controller';
import { CompetencyProfilesService } from './competency-profiles.service';
import { PersonnelProposalsController } from './personnel-proposals.controller';
import { PersonnelProposalsService } from './personnel-proposals.service';
import { AlgorithmsModule } from '../algorithms/algorithms.module';

@Module({
  imports: [AlgorithmsModule],
  controllers: [CompetencyProfilesController, PersonnelProposalsController],
  providers: [CompetencyProfilesService, PersonnelProposalsService],
})
export class PersonnelModule {}

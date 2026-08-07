import { Module } from '@nestjs/common';
import { EmployeeProfilesController } from './employee-profiles.controller';
import { EmployeeProfilesService } from './employee-profiles.service';
import { AlgorithmsModule } from '../algorithms/algorithms.module';

@Module({
  imports: [AlgorithmsModule],
  controllers: [EmployeeProfilesController],
  providers: [EmployeeProfilesService],
})
export class EmployeeProfilesModule {}

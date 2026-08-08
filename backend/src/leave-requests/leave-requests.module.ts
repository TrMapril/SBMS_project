import { Module } from '@nestjs/common';
import { LeaveRequestsController } from './leave-requests.controller';
import { LeaveRequestsService } from './leave-requests.service';
import { StorageModule } from '../common/storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RequestTypesModule } from '../request-types/request-types.module';

@Module({
  imports: [StorageModule, NotificationsModule, RequestTypesModule],
  controllers: [LeaveRequestsController],
  providers: [LeaveRequestsService],
})
export class LeaveRequestsModule {}

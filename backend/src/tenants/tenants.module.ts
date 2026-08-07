import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { UsersModule } from '../users/users.module';
import { StorageModule } from '../common/storage/storage.module';

@Module({
  imports: [UsersModule, StorageModule],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}

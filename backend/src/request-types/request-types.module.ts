import { Module } from '@nestjs/common';
import { RequestTypesService } from './request-types.service';
import { RequestTypesController } from './request-types.controller';

@Module({
  controllers: [RequestTypesController],
  providers: [RequestTypesService],
  exports: [RequestTypesService],
})
export class RequestTypesModule {}

import { Module } from '@nestjs/common';
import { CdkeyController } from './cdkey.controller';
import { CdkeyService } from './cdkey.service';

@Module({
  controllers: [CdkeyController],
  providers: [CdkeyService],
  exports: [CdkeyService],
})
export class CdkeyModule {}

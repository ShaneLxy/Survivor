import { Global, Module } from '@nestjs/common';
import { CloudbaseService } from './cloudbase.service';

@Global()
@Module({
  providers: [CloudbaseService],
  exports: [CloudbaseService],
})
export class CloudbaseModule {}

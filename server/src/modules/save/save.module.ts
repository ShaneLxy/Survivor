import { Module } from '@nestjs/common';
import { GmModule } from '../gm/gm.module';
import { AuditService } from './audit.service';
import { SaveController } from './save.controller';
import { SaveService } from './save.service';

@Module({
  imports: [GmModule],
  controllers: [SaveController],
  providers: [SaveService, AuditService],
  exports: [SaveService, AuditService],
})
export class SaveModule {}

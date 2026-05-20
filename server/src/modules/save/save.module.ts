import { Module } from '@nestjs/common';
import { GmModule } from '../gm/gm.module';
import { SaveController } from './save.controller';
import { SaveService } from './save.service';

@Module({
  imports: [GmModule],
  controllers: [SaveController],
  providers: [SaveService],
  exports: [SaveService],
})
export class SaveModule {}

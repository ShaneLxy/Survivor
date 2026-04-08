import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayerSave } from './entities/player-save.entity';
import { SaveController } from './save.controller';
import { SaveService } from './save.service';

@Module({
  imports: [TypeOrmModule.forFeature([PlayerSave])],
  controllers: [SaveController],
  providers: [SaveService],
  exports: [SaveService],
})
export class SaveModule {}

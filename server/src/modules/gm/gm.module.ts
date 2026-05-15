import { Module } from '@nestjs/common';
import { GmAuthGuard } from './gm-auth.guard';
import { GmCatalogService } from './gm-catalog.service';
import { GmController } from './gm.controller';
import { GmService } from './gm.service';

@Module({
  controllers: [GmController],
  providers: [GmAuthGuard, GmCatalogService, GmService],
  exports: [GmCatalogService, GmService],
})
export class GmModule {}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GmAuthGuard } from './gm-auth.guard';
import { GmCatalogService } from './gm-catalog.service';
import { GmService } from './gm.service';

@Controller('gm')
export class GmController {
  constructor(
    private readonly gmService: GmService,
    private readonly catalogService: GmCatalogService,
  ) {}

  @Get('health')
  @UseGuards(GmAuthGuard)
  health() {
    return { success: true, message: 'GM service ready' };
  }

  @Get('players')
  @UseGuards(GmAuthGuard)
  listPlayers(@Query() query: any) {
    return this.gmService.listPlayers(query);
  }

  @Get('catalog')
  @UseGuards(GmAuthGuard)
  getCatalog() {
    return this.catalogService.getCatalog();
  }

  @Get('catalog/public')
  getPublicCatalog() {
    return this.catalogService.getPublicCatalog();
  }

  @Post('catalog/:type/batch')
  @UseGuards(GmAuthGuard)
  upsertCatalogEntries(
    @Param('type')
    type:
      | 'resources'
      | 'items'
      | 'equipment'
      | 'gachaPools'
      | 'shelterBuildings'
      | 'dungeonChapters'
      | 'dungeons'
      | 'enemies'
      | 'enemySkills'
      | 'shopItems'
      | 'welfareGifts',
    @Body() body: any,
  ) {
    return this.catalogService.upsertEntries(type, body?.entries || body);
  }

  @Put('catalog/:type/:id')
  @UseGuards(GmAuthGuard)
  upsertCatalogEntry(
    @Param('type')
    type:
      | 'resources'
      | 'items'
      | 'equipment'
      | 'gachaPools'
      | 'shelterBuildings'
      | 'dungeonChapters'
      | 'dungeons'
      | 'enemies'
      | 'enemySkills'
      | 'shopItems'
      | 'welfareGifts',
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.catalogService.upsertEntry(type, id, body);
  }

  @Delete('catalog/:type/:id')
  @UseGuards(GmAuthGuard)
  deleteCatalogEntry(
    @Param('type')
    type:
      | 'resources'
      | 'items'
      | 'equipment'
      | 'gachaPools'
      | 'shelterBuildings'
      | 'dungeonChapters'
      | 'dungeons'
      | 'enemies'
      | 'enemySkills'
      | 'shopItems'
      | 'welfareGifts',
    @Param('id') id: string,
  ) {
    return this.catalogService.deleteEntry(type, id);
  }

  @Get('mails')
  @UseGuards(GmAuthGuard)
  listMails(@Query() query: any) {
    return this.gmService.listMails(query);
  }

  @Post('mail/send')
  @UseGuards(GmAuthGuard)
  sendMail(@Body() body: any) {
    return this.gmService.sendMail(body);
  }

  @Get('cdkeys')
  @UseGuards(GmAuthGuard)
  listCdkeys(@Query() query: any) {
    return this.gmService.listCdkeys(query);
  }

  @Post('cdkeys')
  @UseGuards(GmAuthGuard)
  createCdkeys(@Body() body: any) {
    return this.gmService.createCdkeys(body);
  }

  @Put('cdkeys/batch')
  @UseGuards(GmAuthGuard)
  batchUpdateCdkeys(@Body() body: any) {
    return this.gmService.batchUpdateCdkeys(body);
  }

  @Put('cdkeys/:id')
  @UseGuards(GmAuthGuard)
  updateCdkey(@Param('id') id: string, @Body() body: any) {
    return this.gmService.updateCdkey(id, body);
  }

  @Post('cache/bump')
  @UseGuards(GmAuthGuard)
  bumpCacheVersion(@Body() body: any) {
    return this.gmService.bumpCacheVersion(body?.version);
  }
}

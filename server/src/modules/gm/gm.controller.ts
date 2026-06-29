import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

  @Put('players/:id/ban-status')
  @UseGuards(GmAuthGuard)
  updatePlayerBanStatus(@Param('id') id: string, @Body() body: any) {
    return this.gmService.updatePlayerBanStatus(id, body);
  }

  @Put('players/:id/save-audit-bypass')
  @UseGuards(GmAuthGuard)
  updatePlayerSaveAuditBypass(@Param('id') id: string, @Body() body: any) {
    return this.gmService.updatePlayerSaveAuditBypass(id, body);
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

  @Get('operation/public')
  getPublicOperationConfig() {
    return this.gmService.getOperationConfig();
  }

  @Get('operation')
  @UseGuards(GmAuthGuard)
  getOperationConfig() {
    return this.gmService.getOperationConfig();
  }

  @Put('operation')
  @UseGuards(GmAuthGuard)
  updateOperationConfig(@Body() body: any) {
    return this.gmService.updateOperationConfig(body);
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
      | 'heroes'
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

  @Get('audio-config')
  getAudioConfig() {
    return this.gmService.getAudioConfig();
  }

  @Get('audio-config/public')
  getPublicAudioConfig() {
    return this.gmService.getAudioConfig();
  }

  @Get('special-battles/public')
  getPublicSpecialBattleConfig() {
    return this.gmService.getSpecialBattleConfig();
  }

  @Get('special-battles')
  @UseGuards(GmAuthGuard)
  getSpecialBattleConfig() {
    return this.gmService.getSpecialBattleConfig();
  }

  @Put('special-battles')
  @UseGuards(GmAuthGuard)
  updateSpecialBattleConfig(@Body() body: any) {
    return this.gmService.updateSpecialBattleConfig(body);
  }

  @Put('audio-config')
  @UseGuards(GmAuthGuard)
  updateAudioConfig(@Body() body: any) {
    return this.gmService.updateAudioConfig(body);
  }

  @Post('audio/upload')
  @UseGuards(GmAuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  uploadAudio(@UploadedFile() file: Express.Multer.File, @Body() body: any) {
    return this.gmService.uploadAudioFile(file, body?.category);
  }
}

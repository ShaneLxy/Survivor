import { Body, Controller, Delete, Get, Put, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpsertSaveDto } from './dto/upsert-save.dto';
import { SaveService } from './save.service';

// 存档写入限流：autosave 30s 一次约 2/分钟；考虑抽卡 burst（玩家狂点"再十连"
// 每次都触发 game.save() → 400ms 防抖 → PUT），把上限提到 60/分钟留出余量
const SAVE_THROTTLE = { default: { limit: 60, ttl: 60_000 } };

@Controller('save')
@UseGuards(JwtAuthGuard)
export class SaveController {
  constructor(private readonly saveService: SaveService) {}

  @Get()
  getSave(@Req() req: any) {
    return this.saveService.getSaveByAccountId(req.user.id);
  }

  @Put()
  @Throttle(SAVE_THROTTLE)
  save(@Req() req: any, @Body() dto: UpsertSaveDto) {
    return this.saveService.upsertSave(req.user, dto, req);
  }

  @Put('shop/purchase')
  purchaseShopItem(@Req() req: any, @Body() body: any) {
    return this.saveService.buyShopItem(req.user.id, body);
  }

  @Put('checkin/claim')
  claimCheckin(@Req() req: any) {
    return this.saveService.claimDailyCheckin(req.user.id);
  }

  @Put('welfare/claim')
  claimWelfareGift(@Req() req: any, @Body() body: any) {
    return this.saveService.claimWelfareGift(req.user.id, body);
  }

  @Put('month-card/claim')
  claimMonthCard(@Req() req: any, @Body() body: any) {
    return this.saveService.claimMonthCard(req.user.id, body);
  }

  @Delete()
  deleteSave(@Req() req: any) {
    return this.saveService.deleteSave(req.user.id);
  }
}

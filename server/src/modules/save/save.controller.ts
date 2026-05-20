import { Body, Controller, Delete, Get, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpsertSaveDto } from './dto/upsert-save.dto';
import { SaveService } from './save.service';

@Controller('save')
@UseGuards(JwtAuthGuard)
export class SaveController {
  constructor(private readonly saveService: SaveService) {}

  @Get()
  getSave(@Req() req: any) {
    return this.saveService.getSaveByAccountId(req.user.id);
  }

  @Put()
  save(@Req() req: any, @Body() dto: UpsertSaveDto) {
    return this.saveService.upsertSave(req.user, dto);
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

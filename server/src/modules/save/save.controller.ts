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

  @Delete()
  deleteSave(@Req() req: any) {
    return this.saveService.deleteSave(req.user.id);
  }
}

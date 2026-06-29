import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MailService } from './mail.service';

@Controller('mail')
@UseGuards(JwtAuthGuard)
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get()
  list(@Req() req: any, @Query('recent') recent?: string) {
    // recent 是字符串,委托给 service 做规整(支持 null / 非法 / 上限保护)
    const parsed = recent !== undefined ? Number(recent) : undefined;
    return this.mailService.listMails(req.user.id, { recent: parsed });
  }

  @Post('claim-all')
  claimAll(@Req() req: any, @Query('recent') recent?: string) {
    const parsed = recent !== undefined ? Number(recent) : undefined;
    return this.mailService.claimAll(req.user.id, { recent: parsed });
  }

  @Post(':mailId/read')
  markRead(@Req() req: any, @Param('mailId') mailId: string) {
    return this.mailService.markRead(req.user.id, mailId);
  }

  @Post(':mailId/claim')
  claim(@Req() req: any, @Param('mailId') mailId: string) {
    return this.mailService.claim(req.user.id, mailId);
  }
}

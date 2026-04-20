import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MailService } from './mail.service';

@Controller('mail')
@UseGuards(JwtAuthGuard)
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get()
  list(@Req() req: any) {
    return this.mailService.listMails(req.user.id);
  }

  @Post('claim-all')
  claimAll(@Req() req: any) {
    return this.mailService.claimAll(req.user.id);
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

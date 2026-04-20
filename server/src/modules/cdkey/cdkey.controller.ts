import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CdkeyService } from './cdkey.service';

@Controller('cdkey')
@UseGuards(JwtAuthGuard)
export class CdkeyController {
  constructor(private readonly cdkeyService: CdkeyService) {}

  @Post('redeem')
  redeem(@Req() req: any, @Body() body: { code?: string }) {
    return this.cdkeyService.redeem(req.user.id, body?.code || '');
  }
}

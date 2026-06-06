import {
  Body,
  Controller,
  Get,
  NotImplementedException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { TapTapLoginDto } from './dto/taptap-login.dto';

// 登录/注册接口加严限流（防爆破）：60 秒内每个 IP 最多 10 次
const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle(AUTH_THROTTLE)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle(AUTH_THROTTLE)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('wechat/login')
  @Throttle(AUTH_THROTTLE)
  wechatLogin() {
    throw new NotImplementedException('微信登录结构已预留，后续可对接 code2Session');
  }

  @Post('taptap/login')
  @Throttle(AUTH_THROTTLE)
  tapTapLogin(@Body() dto: TapTapLoginDto) {
    return this.authService.tapTapLogin(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: any) {
    return this.authService.getProfile(req.user.id);
  }
}

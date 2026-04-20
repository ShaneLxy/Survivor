import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'survivor_local_secret',
    });
  }

  async validate(payload: any) {
    const user = await this.authService.validateJwtUser(payload?.sub, payload?.sessionVersion);
    if (!user) {
      throw new UnauthorizedException('登录状态已失效，请重新登录');
    }
    return user;
  }
}

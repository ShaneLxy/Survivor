import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GmAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const expectedSecret =
      this.configService.get<string>('GM_SECRET') || process.env.GM_SECRET || '';
    const providedSecret =
      request.headers['x-gm-secret'] ||
      request.headers['x-admin-secret'] ||
      request.query?.gmSecret;

    if (!expectedSecret) {
      throw new UnauthorizedException('GM secret is not configured');
    }

    if (String(providedSecret || '') !== String(expectedSecret)) {
      throw new UnauthorizedException('Invalid GM secret');
    }

    return true;
  }
}

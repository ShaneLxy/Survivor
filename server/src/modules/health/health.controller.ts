import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  check() {
    return {
      success: true,
      message: 'Survivor server is running',
      timestamp: Date.now(),
    };
  }

  @Get('version')
  getVersionPolicy() {
    const defaultVersion = this.configService.get<string>('FRONTEND_BUILD_VERSION') || '2026.04.17.1';

    const createPolicy = (prefix: string, fallbackForce = false) => ({
      latestVersion: this.configService.get<string>(`${prefix}_VERSION_LATEST`) || defaultVersion,
      minSupportedVersion: this.configService.get<string>(`${prefix}_VERSION_MIN`) || defaultVersion,
      forceUpdate: (this.configService.get<string>(`${prefix}_VERSION_FORCE`) || String(fallbackForce)).toLowerCase() === 'true',
      downloadUrl: this.configService.get<string>(`${prefix}_UPDATE_URL`) || '',
      message: this.configService.get<string>(`${prefix}_UPDATE_MESSAGE`) || '',
    });

    return {
      success: true,
      timestamp: Date.now(),
      platforms: {
        web: createPolicy('WEB'),
        android: createPolicy('ANDROID'),
        wechatWeb: createPolicy('WECHAT_WEB'),
        wechatMiniProgram: createPolicy('WECHAT_MINI_PROGRAM'),
      },
    };
  }
}

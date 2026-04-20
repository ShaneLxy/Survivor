import { ConfigService } from '@nestjs/config';
export declare class HealthController {
    private readonly configService;
    constructor(configService: ConfigService);
    check(): {
        success: boolean;
        message: string;
        timestamp: number;
    };
    getVersionPolicy(): {
        success: boolean;
        timestamp: number;
        platforms: {
            web: {
                latestVersion: string;
                minSupportedVersion: string;
                forceUpdate: boolean;
                downloadUrl: string;
                message: string;
            };
            android: {
                latestVersion: string;
                minSupportedVersion: string;
                forceUpdate: boolean;
                downloadUrl: string;
                message: string;
            };
            wechatWeb: {
                latestVersion: string;
                minSupportedVersion: string;
                forceUpdate: boolean;
                downloadUrl: string;
                message: string;
            };
            wechatMiniProgram: {
                latestVersion: string;
                minSupportedVersion: string;
                forceUpdate: boolean;
                downloadUrl: string;
                message: string;
            };
        };
    };
}

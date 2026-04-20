import { ConfigService } from '@nestjs/config';
import { Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';
declare const JwtStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtStrategy extends JwtStrategy_base {
    private readonly authService;
    constructor(configService: ConfigService, authService: AuthService);
    validate(payload: any): Promise<{
        id: string;
        account: string;
        nickname: string;
        loginType: string;
        sessionVersion: number;
        wechatBound: boolean;
        createdAt: string;
        updatedAt: string;
    }>;
}
export {};

import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MongoService } from '../../shared/mongo/mongo.service';
import { UserAccountDocument } from '../../shared/mongo/mongo.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
export declare class AuthService {
    private readonly mongoService;
    private readonly jwtService;
    private readonly configService;
    constructor(mongoService: MongoService, jwtService: JwtService, configService: ConfigService);
    register(dto: RegisterDto): Promise<{
        accessToken: string;
        user: {
            id: string;
            account: string;
            nickname: string;
            loginType: string;
            sessionVersion: number;
            wechatBound: boolean;
            createdAt: string;
            updatedAt: string;
        };
    }>;
    login(dto: LoginDto): Promise<{
        accessToken: string;
        user: {
            id: string;
            account: string;
            nickname: string;
            loginType: string;
            sessionVersion: number;
            wechatBound: boolean;
            createdAt: string;
            updatedAt: string;
        };
    }>;
    validateJwtUser(userId: string, sessionVersion?: number): Promise<{
        id: string;
        account: string;
        nickname: string;
        loginType: string;
        sessionVersion: number;
        wechatBound: boolean;
        createdAt: string;
        updatedAt: string;
    }>;
    getProfile(userId: string): Promise<{
        user: {
            id: string;
            account: string;
            nickname: string;
            loginType: string;
            sessionVersion: number;
            wechatBound: boolean;
            createdAt: string;
            updatedAt: string;
        };
    }>;
    buildAuthResponse(account: UserAccountDocument): {
        accessToken: string;
        user: {
            id: string;
            account: string;
            nickname: string;
            loginType: string;
            sessionVersion: number;
            wechatBound: boolean;
            createdAt: string;
            updatedAt: string;
        };
    };
    serializeUser(account: UserAccountDocument): {
        id: string;
        account: string;
        nickname: string;
        loginType: string;
        sessionVersion: number;
        wechatBound: boolean;
        createdAt: string;
        updatedAt: string;
    };
}

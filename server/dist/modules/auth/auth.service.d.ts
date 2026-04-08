import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { UserAccount } from '../users/entities/user-account.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
export declare class AuthService {
    private readonly accountRepository;
    private readonly jwtService;
    private readonly configService;
    constructor(accountRepository: Repository<UserAccount>, jwtService: JwtService, configService: ConfigService);
    register(dto: RegisterDto): Promise<{
        accessToken: string;
        user: {
            id: number;
            account: string;
            nickname: string;
            loginType: string;
            wechatBound: boolean;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
    login(dto: LoginDto): Promise<{
        accessToken: string;
        user: {
            id: number;
            account: string;
            nickname: string;
            loginType: string;
            wechatBound: boolean;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
    validateJwtUser(userId: number): Promise<UserAccount>;
    getProfile(userId: number): Promise<{
        user: {
            id: number;
            account: string;
            nickname: string;
            loginType: string;
            wechatBound: boolean;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
    buildAuthResponse(account: UserAccount): {
        accessToken: string;
        user: {
            id: number;
            account: string;
            nickname: string;
            loginType: string;
            wechatBound: boolean;
            createdAt: Date;
            updatedAt: Date;
        };
    };
    serializeUser(account: UserAccount): {
        id: number;
        account: string;
        nickname: string;
        loginType: string;
        wechatBound: boolean;
        createdAt: Date;
        updatedAt: Date;
    };
}

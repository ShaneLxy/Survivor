import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
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
    wechatLogin(): void;
    me(req: any): Promise<{
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
}

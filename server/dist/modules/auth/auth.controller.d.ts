import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
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
    wechatLogin(): void;
    me(req: any): Promise<{
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
}

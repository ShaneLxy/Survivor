"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcryptjs"));
const cloudbase_service_1 = require("../../shared/cloudbase/cloudbase.service");
let AuthService = class AuthService {
    constructor(cloudbaseService, jwtService, configService) {
        this.cloudbaseService = cloudbaseService;
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async register(dto) {
        const account = dto.account.trim();
        console.log('[AuthService.register] start:', { account });
        try {
            const collection = this.cloudbaseService.userAccounts();
            const existing = await this.cloudbaseService.findOne(collection, { account });
            if (existing) {
                throw new common_1.BadRequestException('Account already exists');
            }
            const now = this.cloudbaseService.nowIso();
            const passwordHash = await bcrypt.hash(dto.password, 10);
            const sessionVersion = 1;
            const id = await this.cloudbaseService.insert(collection, {
                account,
                passwordHash,
                nickname: dto.nickname?.trim() || account,
                loginType: 'local',
                sessionVersion,
                wechatOpenId: null,
                wechatUnionId: null,
                lastLoginAt: now,
                createdAt: now,
                updatedAt: now,
            });
            const saved = await this.cloudbaseService.getById(collection, id);
            console.log('[AuthService.register] success:', { account, id });
            return this.buildAuthResponse(saved);
        }
        catch (error) {
            console.error('[AuthService.register] failed:', { account, error });
            throw error;
        }
    }
    async login(dto) {
        const account = dto.account.trim();
        console.log('[AuthService.login] start:', { account });
        try {
            const collection = this.cloudbaseService.userAccounts();
            const entity = (await this.cloudbaseService.findOne(collection, {
                account,
            }));
            console.log('[AuthService.login] findOne result:', {
                account,
                found: Boolean(entity),
                hasPasswordHash: Boolean(entity?.passwordHash),
                id: entity?._id || null,
            });
            if (!entity || !entity.passwordHash) {
                throw new common_1.UnauthorizedException('Invalid account or password');
            }
            const matched = await bcrypt.compare(dto.password, entity.passwordHash);
            console.log('[AuthService.login] password compare:', { account, matched });
            if (!matched) {
                throw new common_1.UnauthorizedException('Invalid account or password');
            }
            const lastLoginAt = this.cloudbaseService.nowIso();
            const sessionVersion = (Number(entity.sessionVersion) || 0) + 1;
            await this.cloudbaseService.updateById(collection, entity._id, {
                lastLoginAt,
                sessionVersion,
                updatedAt: lastLoginAt,
            });
            const saved = await this.cloudbaseService.getById(collection, entity._id);
            console.log('[AuthService.login] success:', { account, id: entity._id });
            return this.buildAuthResponse(saved);
        }
        catch (error) {
            console.error('[AuthService.login] failed:', { account, error });
            throw error;
        }
    }
    async validateJwtUser(userId, sessionVersion) {
        if (!userId) {
            return null;
        }
        const collection = this.cloudbaseService.userAccounts();
        const entity = await this.cloudbaseService.getById(collection, userId);
        if (!entity) {
            return null;
        }
        const account = entity;
        const currentSessionVersion = Number(account.sessionVersion) || 0;
        if (Number.isFinite(Number(sessionVersion)) && Number(sessionVersion) !== currentSessionVersion) {
            return null;
        }
        return this.serializeUser(account);
    }
    async getProfile(userId) {
        const collection = this.cloudbaseService.userAccounts();
        const entity = await this.cloudbaseService.getById(collection, userId);
        if (!entity) {
            throw new common_1.NotFoundException('Account not found');
        }
        return { user: this.serializeUser(entity) };
    }
    buildAuthResponse(account) {
        const payload = {
            sub: account._id,
            loginType: account.loginType,
            sessionVersion: Number(account.sessionVersion) || 0,
        };
        const accessToken = this.jwtService.sign(payload, {
            secret: this.configService.get('JWT_SECRET') || 'survivor_local_secret',
            expiresIn: this.configService.get('JWT_EXPIRES_IN') || '7d',
        });
        return {
            accessToken,
            user: this.serializeUser(account),
        };
    }
    serializeUser(account) {
        return {
            id: account._id,
            account: account.account,
            nickname: account.nickname,
            loginType: account.loginType,
            sessionVersion: Number(account.sessionVersion) || 0,
            wechatBound: Boolean(account.wechatOpenId),
            createdAt: account.createdAt,
            updatedAt: account.updatedAt,
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [cloudbase_service_1.CloudbaseService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map
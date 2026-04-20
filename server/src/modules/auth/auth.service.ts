import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { CloudbaseService } from '../../shared/cloudbase/cloudbase.service';
import { UserAccountDocument } from '../../shared/cloudbase/cloudbase.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly cloudbaseService: CloudbaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const account = dto.account.trim();
    console.log('[AuthService.register] start:', { account });
    try {
      const collection = this.cloudbaseService.userAccounts();
      const existing = await this.cloudbaseService.findOne(collection, { account });
      if (existing) {
        throw new BadRequestException('Account already exists');
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
      return this.buildAuthResponse(saved as UserAccountDocument);
    } catch (error) {
      console.error('[AuthService.register] failed:', { account, error });
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const account = dto.account.trim();
    console.log('[AuthService.login] start:', { account });
    try {
      const collection = this.cloudbaseService.userAccounts();
      const entity = (await this.cloudbaseService.findOne(collection, {
        account,
      })) as UserAccountDocument | null;
      console.log('[AuthService.login] findOne result:', {
        account,
        found: Boolean(entity),
        hasPasswordHash: Boolean(entity?.passwordHash),
        id: entity?._id || null,
      });
      if (!entity || !entity.passwordHash) {
        throw new UnauthorizedException('Invalid account or password');
      }

      const matched = await bcrypt.compare(dto.password, entity.passwordHash);
      console.log('[AuthService.login] password compare:', { account, matched });
      if (!matched) {
        throw new UnauthorizedException('Invalid account or password');
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
      return this.buildAuthResponse(saved as UserAccountDocument);
    } catch (error) {
      console.error('[AuthService.login] failed:', { account, error });
      throw error;
    }
  }

  async validateJwtUser(userId: string, sessionVersion?: number) {
    if (!userId) {
      return null;
    }
    const collection = this.cloudbaseService.userAccounts();
    const entity = await this.cloudbaseService.getById(collection, userId);
    if (!entity) {
      return null;
    }
    const account = entity as UserAccountDocument;
    const currentSessionVersion = Number(account.sessionVersion) || 0;
    if (Number.isFinite(Number(sessionVersion)) && Number(sessionVersion) !== currentSessionVersion) {
      return null;
    }
    return this.serializeUser(account);
  }

  async getProfile(userId: string) {
    const collection = this.cloudbaseService.userAccounts();
    const entity = await this.cloudbaseService.getById(collection, userId);
    if (!entity) {
      throw new NotFoundException('Account not found');
    }
    return { user: this.serializeUser(entity as UserAccountDocument) };
  }

  buildAuthResponse(account: UserAccountDocument) {
    const payload = {
      sub: account._id,
      loginType: account.loginType,
      sessionVersion: Number(account.sessionVersion) || 0,
    };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET') || 'survivor_local_secret',
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '7d',
    });
    return {
      accessToken,
      user: this.serializeUser(account),
    };
  }

  serializeUser(account: UserAccountDocument) {
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
}

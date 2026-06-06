import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { MongoService } from '../../shared/mongo/mongo.service';
import { UserAccountDocument } from '../../shared/mongo/mongo.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { TapTapLoginDto } from './dto/taptap-login.dto';
import { generateUniqueNickname, validateUserNickname } from '../../shared/nickname';

@Injectable()
export class AuthService {
  constructor(
    private readonly mongoService: MongoService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private assertNotBanned(entity: UserAccountDocument | null) {
    if (entity?.banStatus?.bannedAt) {
      throw new ForbiddenException({
        code: 'ACCOUNT_BANNED',
        message: `账号已被封禁（${entity.banStatus.reason || '存档异常'}），如有疑问请联系客服`,
        bannedAt: entity.banStatus.bannedAt,
      });
    }
  }

  async register(dto: RegisterDto) {
    const account = dto.account.trim();
    console.log('[AuthService.register] start:', { account });
    try {
      const collection = this.mongoService.userAccounts();
      const existing = await this.mongoService.findOne(collection, { account });
      if (existing) {
        throw new BadRequestException('Account already exists');
      }

      // 生成或验证昵称
      let nickname: string;
      if (dto.nickname?.trim()) {
        // 用户提供了昵称，需要验证
        const validation = await validateUserNickname(
          dto.nickname.trim(),
          async (nick) => await this.isNicknameUnique(nick)
        );
        if (!validation.valid) {
          throw new BadRequestException(validation.reason || '昵称不合法');
        }
        nickname = dto.nickname.trim();
      } else {
        // 自动生成随机昵称
        const result = await generateUniqueNickname({
          maxAttempts: 50,
          checkUniqueness: async (nick) => await this.isNicknameUnique(nick)
        });
        if (!result.success) {
          throw new BadRequestException('生成昵称失败，请稍后重试');
        }
        nickname = result.nickname!;
        console.log('[AuthService.register] generated nickname:', { nickname, attempts: result.attempts });
      }

      const now = this.mongoService.nowIso();
      const passwordHash = await bcrypt.hash(dto.password, 10);
      const sessionVersion = 1;
      const id = await this.mongoService.insert(collection, {
        account,
        passwordHash,
        nickname,
        loginType: 'local',
        sessionVersion,
        wechatOpenId: null,
        wechatUnionId: null,
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now,
      });
      const saved = await this.mongoService.getById(collection, id);
      console.log('[AuthService.register] success:', { account, id, nickname });
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
      const collection = this.mongoService.userAccounts();
      const entity = (await this.mongoService.findOne(collection, {
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

      this.assertNotBanned(entity);

      const lastLoginAt = this.mongoService.nowIso();
      const sessionVersion = (Number(entity.sessionVersion) || 0) + 1;
      await this.mongoService.updateById(collection, entity._id, {
        lastLoginAt,
        sessionVersion,
        updatedAt: lastLoginAt,
      });
      const saved = await this.mongoService.getById(collection, entity._id);
      console.log('[AuthService.login] success:', { account, id: entity._id });
      return this.buildAuthResponse(saved as UserAccountDocument);
    } catch (error) {
      console.error('[AuthService.login] failed:', { account, error });
      throw error;
    }
  }

  async tapTapLogin(dto: TapTapLoginDto) {
    const openId = String(dto.openId || '').trim();
    const unionId = String(dto.unionId || '').trim();
    if (!openId && !unionId) {
      throw new BadRequestException('TapTap login missing account identity');
    }

    const collection = this.mongoService.userAccounts();
    const identityFilter = unionId
      ? { $or: [{ taptapUnionId: unionId }, { taptapOpenId: openId }] }
      : { taptapOpenId: openId };
    const entity = (await this.mongoService.findOne(collection, identityFilter as any)) as
      | UserAccountDocument
      | null;

    const now = this.mongoService.nowIso();
    if (entity) {
      this.assertNotBanned(entity);
      const sessionVersion = (Number(entity.sessionVersion) || 0) + 1;

      // 如果用户提供了新昵称，验证并更新
      let nickname = entity.nickname;
      if (dto.nickname?.trim() && dto.nickname.trim() !== entity.nickname) {
        const validation = await validateUserNickname(
          dto.nickname.trim(),
          async (nick) => await this.isNicknameUnique(nick, entity._id)
        );
        if (validation.valid) {
          nickname = dto.nickname.trim();
        }
      }

      await this.mongoService.updateById(collection, entity._id, {
        nickname: nickname || 'TapTap玩家',
        taptapOpenId: openId || (entity as any).taptapOpenId || null,
        taptapUnionId: unionId || (entity as any).taptapUnionId || null,
        taptapAvatar: dto.avatar || (entity as any).taptapAvatar || null,
        lastLoginAt: now,
        sessionVersion,
        updatedAt: now,
      } as any);
      const saved = await this.mongoService.getById(collection, entity._id);
      return this.buildAuthResponse(saved as UserAccountDocument);
    }

    // 新用户注册，生成随机昵称
    let nickname: string;
    if (dto.nickname?.trim()) {
      const validation = await validateUserNickname(
        dto.nickname.trim(),
        async (nick) => await this.isNicknameUnique(nick)
      );
      nickname = validation.valid ? dto.nickname.trim() : 'TapTap玩家';
    } else {
      const result = await generateUniqueNickname({
        maxAttempts: 50,
        checkUniqueness: async (nick) => await this.isNicknameUnique(nick)
      });
      nickname = result.success ? result.nickname! : 'TapTap玩家';
    }

    const suffix = unionId || openId;
    const account = `taptap_${suffix}`;
    const sessionVersion = 1;
    const id = await this.mongoService.insert(collection, {
      account,
      passwordHash: null,
      nickname,
      loginType: 'taptap',
      sessionVersion,
      wechatOpenId: null,
      wechatUnionId: null,
      taptapOpenId: openId || null,
      taptapUnionId: unionId || null,
      taptapAvatar: dto.avatar || null,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    } as any);
    const saved = await this.mongoService.getById(collection, id);
    return this.buildAuthResponse(saved as UserAccountDocument);
  }

  /**
   * 检查昵称是否唯一
   * @param nickname 待检查的昵称
   * @param excludeUserId 排除的用户ID（用于更新昵称时）
   * @returns true表示唯一，false表示已存在
   */
  private async isNicknameUnique(nickname: string, excludeUserId?: string): Promise<boolean> {
    const collection = this.mongoService.userAccounts();
    const filter: any = { nickname };
    if (excludeUserId) {
      filter._id = { $ne: excludeUserId };
    }
    const existing = await this.mongoService.findOne(collection, filter);
    return !existing;
  }

  async validateJwtUser(userId: string, sessionVersion?: number) {
    if (!userId) {
      return null;
    }
    const collection = this.mongoService.userAccounts();
    const entity = await this.mongoService.getById(collection, userId);
    if (!entity) {
      return null;
    }
    const account = entity as UserAccountDocument;
    const currentSessionVersion = Number(account.sessionVersion) || 0;
    if (Number.isFinite(Number(sessionVersion)) && Number(sessionVersion) !== currentSessionVersion) {
      return null;
    }
    // 封禁账号即使 JWT 仍有效也直接拒绝（在线封禁实时生效）
    if (account.banStatus?.bannedAt) {
      throw new ForbiddenException({
        code: 'ACCOUNT_BANNED',
        message: `账号已被封禁（${account.banStatus.reason || '存档异常'}），如有疑问请联系客服`,
        bannedAt: account.banStatus.bannedAt,
      });
    }
    return this.serializeUser(account);
  }

  async getProfile(userId: string) {
    const collection = this.mongoService.userAccounts();
    const entity = await this.mongoService.getById(collection, userId);
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

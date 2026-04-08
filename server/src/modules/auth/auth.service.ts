import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { UserAccount } from '../users/entities/user-account.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserAccount)
    private readonly accountRepository: Repository<UserAccount>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const account = dto.account.trim();
    const existing = await this.accountRepository.findOne({ where: { account } });
    if (existing) {
      throw new BadRequestException('该账号已存在');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const entity = this.accountRepository.create({
      account,
      passwordHash,
      nickname: dto.nickname?.trim() || account,
      loginType: 'local',
      lastLoginAt: new Date(),
    });
    const saved = await this.accountRepository.save(entity);
    return this.buildAuthResponse(saved);
  }

  async login(dto: LoginDto) {
    const account = dto.account.trim();
    const entity = await this.accountRepository.findOne({ where: { account } });
    if (!entity || !entity.passwordHash) {
      throw new UnauthorizedException('账号或密码错误');
    }

    const matched = await bcrypt.compare(dto.password, entity.passwordHash);
    if (!matched) {
      throw new UnauthorizedException('账号或密码错误');
    }

    entity.lastLoginAt = new Date();
    const saved = await this.accountRepository.save(entity);
    return this.buildAuthResponse(saved);
  }

  async validateJwtUser(userId: number) {
    if (!userId) {
      return null;
    }
    return this.accountRepository.findOne({ where: { id: userId } });
  }

  async getProfile(userId: number) {
    const entity = await this.accountRepository.findOne({ where: { id: userId } });
    if (!entity) {
      throw new NotFoundException('账号不存在');
    }
    return { user: this.serializeUser(entity) };
  }

  buildAuthResponse(account: UserAccount) {
    const payload = { sub: account.id, loginType: account.loginType };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET') || 'survivor_local_secret',
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '7d',
    });
    return {
      accessToken,
      user: this.serializeUser(account),
    };
  }

  serializeUser(account: UserAccount) {
    return {
      id: account.id,
      account: account.account,
      nickname: account.nickname,
      loginType: account.loginType,
      wechatBound: Boolean(account.wechatOpenId),
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }
}

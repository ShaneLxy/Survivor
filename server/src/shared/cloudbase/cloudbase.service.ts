import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cloudbase from '@cloudbase/node-sdk';

@Injectable()
export class CloudbaseService {
  private readonly app: any;
  private readonly db: any;
  private readonly userAccountsCollectionName: string;
  private readonly playerSavesCollectionName: string;
  private readonly playerMailsCollectionName: string;
  private readonly cdkeysCollectionName: string;

  constructor(private readonly configService: ConfigService) {
    const env =
      this.configService.get<string>('CLOUDBASE_ENV_ID') ||
      this.configService.get<string>('TCB_ENV') ||
      process.env.CLOUDBASE_ENV_ID ||
      process.env.TCB_ENV;
    const secretId =
      this.configService.get<string>('SECRET_ID') ||
      process.env.SECRET_ID ||
      process.env.CLOUDBASE_SECRET_ID ||
      process.env.TENCENTCLOUD_SECRETID ||
      process.env.TCB_SECRETID;
    const secretKey =
      this.configService.get<string>('SECRET_KEY') ||
      process.env.SECRET_KEY ||
      process.env.CLOUDBASE_SECRET_KEY ||
      process.env.TENCENTCLOUD_SECRETKEY ||
      process.env.TCB_SECRETKEY;
    const sessionToken =
      this.configService.get<string>('SESSION_TOKEN') ||
      process.env.SESSION_TOKEN ||
      process.env.TENCENTCLOUD_SESSIONTOKEN ||
      process.env.TCB_SESSIONTOKEN;

    if (!env) {
      throw new Error('Missing CloudBase environment id. Please set CLOUDBASE_ENV_ID.');
    }

    const initConfig: Record<string, string> = { env };
    if (secretId && secretKey) {
      initConfig.secretId = secretId;
      initConfig.secretKey = secretKey;
      if (sessionToken) {
        initConfig.sessionToken = sessionToken;
      }
    }

    this.app = cloudbase.init(initConfig);
    this.db = this.app.database();
    this.userAccountsCollectionName =
      this.configService.get<string>('CLOUDBASE_USER_COLLECTION') || 'useraccounts';
    this.playerSavesCollectionName =
      this.configService.get<string>('CLOUDBASE_SAVE_COLLECTION') || 'playersaves';
    this.playerMailsCollectionName =
      this.configService.get<string>('CLOUDBASE_MAIL_COLLECTION') || 'playermails';
    this.cdkeysCollectionName =
      this.configService.get<string>('CLOUDBASE_CDKEY_COLLECTION') || 'cdkeys';
  }

  userAccounts() {
    return this.db.collection(this.userAccountsCollectionName);
  }

  playerSaves() {
    return this.db.collection(this.playerSavesCollectionName);
  }

  playerMails() {
    return this.db.collection(this.playerMailsCollectionName);
  }

  cdkeys() {
    return this.db.collection(this.cdkeysCollectionName);
  }

  async findOne(collection: any, where: Record<string, any>) {
    try {
      const result = await collection.where(where).limit(1).get();
      return result?.data?.[0] || null;
    } catch (error) {
      console.error('[CloudbaseService.findOne] failed:', { where, error });
      throw error;
    }
  }

  async getById(collection: any, id: string) {
    try {
      const result = await collection.doc(id).get();
      if (!result) {
        return null;
      }
      if (Array.isArray(result.data)) {
        return result.data[0] || null;
      }
      return result.data || null;
    } catch (error) {
      console.error('[CloudbaseService.getById] failed:', { id, error });
      throw error;
    }
  }

  async findMany(collection: any, where: Record<string, any>) {
    try {
      const result = await collection.where(where).get();
      return Array.isArray(result?.data) ? result.data : [];
    } catch (error) {
      console.error('[CloudbaseService.findMany] failed:', { where, error });
      throw error;
    }
  }

  async insert(collection: any, data: Record<string, any>) {
    try {
      const result = await collection.add(data);
      const id = result?.id || result?._id || result?.idList?.[0] || null;
      if (!id) {
        throw new InternalServerErrorException('CloudBase insert failed');
      }
      return id;
    } catch (error) {
      console.error('[CloudbaseService.insert] failed:', error);
      throw error;
    }
  }

  async updateById(collection: any, id: string, data: Record<string, any>) {
    try {
      return await collection.doc(id).update(data);
    } catch (error) {
      console.error('[CloudbaseService.updateById] failed:', { id, data, error });
      throw error;
    }
  }

  async removeWhere(collection: any, where: Record<string, any>) {
    try {
      return await collection.where(where).remove();
    } catch (error) {
      console.error('[CloudbaseService.removeWhere] failed:', { where, error });
      throw error;
    }
  }

  nowIso() {
    return new Date().toISOString();
  }
}

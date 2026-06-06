import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Collection, Db, Document, Filter, MongoClient, ObjectId, WithId } from 'mongodb';

@Injectable()
export class MongoService implements OnModuleInit, OnModuleDestroy {
  private readonly client: MongoClient;
  private readonly dbName: string;
  private db: Db | null = null;
  private readonly userAccountsCollectionName: string;
  private readonly playerSavesCollectionName: string;
  private readonly playerMailsCollectionName: string;
  private readonly cdkeysCollectionName: string;
  private readonly operationConfigCollectionName: string;
  private readonly auditLogsCollectionName: string;

  constructor(private readonly configService: ConfigService) {
    const uri =
      this.configService.get<string>('MONGODB_URI') ||
      process.env.MONGODB_URI ||
      'mongodb://127.0.0.1:27017';

    this.dbName =
      this.configService.get<string>('MONGODB_DB_NAME') ||
      process.env.MONGODB_DB_NAME ||
      'survivor';

    this.userAccountsCollectionName =
      this.configService.get<string>('MONGODB_USER_COLLECTION') || 'useraccounts';
    this.playerSavesCollectionName =
      this.configService.get<string>('MONGODB_SAVE_COLLECTION') || 'playersaves';
    this.playerMailsCollectionName =
      this.configService.get<string>('MONGODB_MAIL_COLLECTION') || 'playermails';
    this.cdkeysCollectionName =
      this.configService.get<string>('MONGODB_CDKEY_COLLECTION') || 'cdkeys';
    this.operationConfigCollectionName =
      this.configService.get<string>('MONGODB_OPERATION_CONFIG_COLLECTION') || 'operationconfigs';
    this.auditLogsCollectionName =
      this.configService.get<string>('MONGODB_AUDITLOGS_COLLECTION') || 'auditlogs';

    this.client = new MongoClient(uri);
  }

  async onModuleInit() {
    await this.client.connect();
    this.db = this.client.db(this.dbName);
    await Promise.all([
      this.userAccounts().createIndex({ account: 1 }, { unique: true, sparse: true }),
      this.userAccounts().createIndex({ taptapOpenId: 1 }, { unique: true, sparse: true }),
      this.userAccounts().createIndex({ taptapUnionId: 1 }, { unique: true, sparse: true }),
      this.playerSaves().createIndex({ accountId: 1 }, { unique: true }),
      this.playerMails().createIndex({ accountId: 1 }),
      this.cdkeys().createIndex({ code: 1 }, { unique: true }),
      this.auditLogs().createIndex({ accountId: 1, createdAt: -1 }),
      this.auditLogs().createIndex({ type: 1, createdAt: -1 }),
      // TTL 索引：90 天后自动删除（MongoDB 仅对 BSON Date 字段生效，所以 writeLog 必须写入 Date 对象）
      this.auditLogs().createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: 90 * 24 * 3600 },
      ),
    ]);
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  userAccounts() {
    return this.collection(this.userAccountsCollectionName);
  }

  playerSaves() {
    return this.collection(this.playerSavesCollectionName);
  }

  playerMails() {
    return this.collection(this.playerMailsCollectionName);
  }

  cdkeys() {
    return this.collection(this.cdkeysCollectionName);
  }

  operationConfigs() {
    return this.collection(this.operationConfigCollectionName);
  }

  auditLogs() {
    return this.collection(this.auditLogsCollectionName);
  }

  async findOne<T extends Document>(collection: Collection<T>, where: Filter<T>) {
    const result = await collection.findOne(where);
    return this.serializeDocument<T>(result);
  }

  async getById<T extends Document>(collection: Collection<T>, id: string) {
    const result = await collection.findOne(this.buildIdFilter<T>(id));
    return this.serializeDocument<T>(result);
  }

  async findMany<T extends Document>(collection: Collection<T>, where: Filter<T>) {
    const results = await collection.find(where).toArray();
    return results.map((entry) => this.serializeDocument<T>(entry)).filter(Boolean) as Array<
      T & { _id: string }
    >;
  }

  async insert<T extends Document>(collection: Collection<T>, data: Partial<T>) {
    const result = await collection.insertOne(data as any);
    return result.insertedId.toHexString();
  }

  async updateById<T extends Document>(collection: Collection<T>, id: string, data: Partial<T>) {
    return collection.updateOne(this.buildIdFilter<T>(id), { $set: data });
  }

  async removeWhere<T extends Document>(collection: Collection<T>, where: Filter<T>) {
    return collection.deleteMany(where);
  }

  nowIso() {
    return new Date().toISOString();
  }

  private collection(name: string) {
    if (!this.db) {
      throw new Error('MongoDB is not connected yet.');
    }
    return this.db.collection(name);
  }

  private buildIdFilter<T extends Document>(id: string) {
    if (ObjectId.isValid(id)) {
      return { _id: new ObjectId(id) } as Filter<T>;
    }
    return { _id: id } as Filter<T>;
  }

  private serializeDocument<T extends Document>(document: WithId<T> | null) {
    if (!document) {
      return null;
    }

    const rawId = document._id;
    return {
      ...document,
      _id: rawId instanceof ObjectId ? rawId.toHexString() : String(rawId || ''),
    };
  }
}

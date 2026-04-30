import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Collection, Document, Filter } from 'mongodb';
export declare class MongoService implements OnModuleInit, OnModuleDestroy {
    private readonly configService;
    private readonly client;
    private readonly dbName;
    private db;
    private readonly userAccountsCollectionName;
    private readonly playerSavesCollectionName;
    private readonly playerMailsCollectionName;
    private readonly cdkeysCollectionName;
    constructor(configService: ConfigService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    userAccounts(): Collection<Document>;
    playerSaves(): Collection<Document>;
    playerMails(): Collection<Document>;
    cdkeys(): Collection<Document>;
    findOne<T extends Document>(collection: Collection<T>, where: Filter<T>): Promise<import("mongodb").EnhancedOmit<T, "_id"> & {
        _id: string;
    }>;
    getById<T extends Document>(collection: Collection<T>, id: string): Promise<import("mongodb").EnhancedOmit<T, "_id"> & {
        _id: string;
    }>;
    findMany<T extends Document>(collection: Collection<T>, where: Filter<T>): Promise<(T & {
        _id: string;
    })[]>;
    insert<T extends Document>(collection: Collection<T>, data: Partial<T>): Promise<string>;
    updateById<T extends Document>(collection: Collection<T>, id: string, data: Partial<T>): Promise<import("mongodb").UpdateResult<T>>;
    removeWhere<T extends Document>(collection: Collection<T>, where: Filter<T>): Promise<import("mongodb").DeleteResult>;
    nowIso(): string;
    private collection;
    private buildIdFilter;
    private serializeDocument;
}

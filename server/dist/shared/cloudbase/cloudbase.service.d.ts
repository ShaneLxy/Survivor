import { ConfigService } from '@nestjs/config';
export declare class CloudbaseService {
    private readonly configService;
    private readonly app;
    private readonly db;
    private readonly userAccountsCollectionName;
    private readonly playerSavesCollectionName;
    private readonly playerMailsCollectionName;
    private readonly cdkeysCollectionName;
    constructor(configService: ConfigService);
    userAccounts(): any;
    playerSaves(): any;
    playerMails(): any;
    cdkeys(): any;
    findOne(collection: any, where: Record<string, any>): Promise<any>;
    getById(collection: any, id: string): Promise<any>;
    findMany(collection: any, where: Record<string, any>): Promise<any>;
    insert(collection: any, data: Record<string, any>): Promise<any>;
    updateById(collection: any, id: string, data: Record<string, any>): Promise<any>;
    removeWhere(collection: any, where: Record<string, any>): Promise<any>;
    nowIso(): string;
}

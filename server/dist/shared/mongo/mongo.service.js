"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mongodb_1 = require("mongodb");
let MongoService = class MongoService {
    constructor(configService) {
        this.configService = configService;
        this.db = null;
        const uri = this.configService.get('MONGODB_URI') ||
            process.env.MONGODB_URI ||
            'mongodb://127.0.0.1:27017';
        this.dbName =
            this.configService.get('MONGODB_DB_NAME') ||
                process.env.MONGODB_DB_NAME ||
                'survivor';
        this.userAccountsCollectionName =
            this.configService.get('MONGODB_USER_COLLECTION') || 'useraccounts';
        this.playerSavesCollectionName =
            this.configService.get('MONGODB_SAVE_COLLECTION') || 'playersaves';
        this.playerMailsCollectionName =
            this.configService.get('MONGODB_MAIL_COLLECTION') || 'playermails';
        this.cdkeysCollectionName =
            this.configService.get('MONGODB_CDKEY_COLLECTION') || 'cdkeys';
        this.client = new mongodb_1.MongoClient(uri);
    }
    async onModuleInit() {
        await this.client.connect();
        this.db = this.client.db(this.dbName);
        await Promise.all([
            this.userAccounts().createIndex({ account: 1 }, { unique: true, sparse: true }),
            this.playerSaves().createIndex({ accountId: 1 }, { unique: true }),
            this.playerMails().createIndex({ accountId: 1 }),
            this.cdkeys().createIndex({ code: 1 }, { unique: true }),
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
    async findOne(collection, where) {
        const result = await collection.findOne(where);
        return this.serializeDocument(result);
    }
    async getById(collection, id) {
        const result = await collection.findOne(this.buildIdFilter(id));
        return this.serializeDocument(result);
    }
    async findMany(collection, where) {
        const results = await collection.find(where).toArray();
        return results.map((entry) => this.serializeDocument(entry)).filter(Boolean);
    }
    async insert(collection, data) {
        const result = await collection.insertOne(data);
        return result.insertedId.toHexString();
    }
    async updateById(collection, id, data) {
        return collection.updateOne(this.buildIdFilter(id), { $set: data });
    }
    async removeWhere(collection, where) {
        return collection.deleteMany(where);
    }
    nowIso() {
        return new Date().toISOString();
    }
    collection(name) {
        if (!this.db) {
            throw new Error('MongoDB is not connected yet.');
        }
        return this.db.collection(name);
    }
    buildIdFilter(id) {
        if (mongodb_1.ObjectId.isValid(id)) {
            return { _id: new mongodb_1.ObjectId(id) };
        }
        return { _id: id };
    }
    serializeDocument(document) {
        if (!document) {
            return null;
        }
        const rawId = document._id;
        return {
            ...document,
            _id: rawId instanceof mongodb_1.ObjectId ? rawId.toHexString() : String(rawId || ''),
        };
    }
};
exports.MongoService = MongoService;
exports.MongoService = MongoService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MongoService);
//# sourceMappingURL=mongo.service.js.map
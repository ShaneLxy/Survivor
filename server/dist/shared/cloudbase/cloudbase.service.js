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
exports.CloudbaseService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const cloudbase = __importStar(require("@cloudbase/node-sdk"));
let CloudbaseService = class CloudbaseService {
    constructor(configService) {
        this.configService = configService;
        const env = this.configService.get('CLOUDBASE_ENV_ID') ||
            this.configService.get('TCB_ENV') ||
            process.env.CLOUDBASE_ENV_ID ||
            process.env.TCB_ENV;
        const secretId = this.configService.get('SECRET_ID') ||
            process.env.SECRET_ID ||
            process.env.CLOUDBASE_SECRET_ID ||
            process.env.TENCENTCLOUD_SECRETID ||
            process.env.TCB_SECRETID;
        const secretKey = this.configService.get('SECRET_KEY') ||
            process.env.SECRET_KEY ||
            process.env.CLOUDBASE_SECRET_KEY ||
            process.env.TENCENTCLOUD_SECRETKEY ||
            process.env.TCB_SECRETKEY;
        const sessionToken = this.configService.get('SESSION_TOKEN') ||
            process.env.SESSION_TOKEN ||
            process.env.TENCENTCLOUD_SESSIONTOKEN ||
            process.env.TCB_SESSIONTOKEN;
        if (!env) {
            throw new Error('Missing CloudBase environment id. Please set CLOUDBASE_ENV_ID.');
        }
        const initConfig = { env };
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
            this.configService.get('CLOUDBASE_USER_COLLECTION') || 'useraccounts';
        this.playerSavesCollectionName =
            this.configService.get('CLOUDBASE_SAVE_COLLECTION') || 'playersaves';
        this.playerMailsCollectionName =
            this.configService.get('CLOUDBASE_MAIL_COLLECTION') || 'playermails';
        this.cdkeysCollectionName =
            this.configService.get('CLOUDBASE_CDKEY_COLLECTION') || 'cdkeys';
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
    async findOne(collection, where) {
        try {
            const result = await collection.where(where).limit(1).get();
            return result?.data?.[0] || null;
        }
        catch (error) {
            console.error('[CloudbaseService.findOne] failed:', { where, error });
            throw error;
        }
    }
    async getById(collection, id) {
        try {
            const result = await collection.doc(id).get();
            if (!result) {
                return null;
            }
            if (Array.isArray(result.data)) {
                return result.data[0] || null;
            }
            return result.data || null;
        }
        catch (error) {
            console.error('[CloudbaseService.getById] failed:', { id, error });
            throw error;
        }
    }
    async findMany(collection, where) {
        try {
            const result = await collection.where(where).get();
            return Array.isArray(result?.data) ? result.data : [];
        }
        catch (error) {
            console.error('[CloudbaseService.findMany] failed:', { where, error });
            throw error;
        }
    }
    async insert(collection, data) {
        try {
            const result = await collection.add(data);
            const id = result?.id || result?._id || result?.idList?.[0] || null;
            if (!id) {
                throw new common_1.InternalServerErrorException('CloudBase insert failed');
            }
            return id;
        }
        catch (error) {
            console.error('[CloudbaseService.insert] failed:', error);
            throw error;
        }
    }
    async updateById(collection, id, data) {
        try {
            return await collection.doc(id).update(data);
        }
        catch (error) {
            console.error('[CloudbaseService.updateById] failed:', { id, data, error });
            throw error;
        }
    }
    async removeWhere(collection, where) {
        try {
            return await collection.where(where).remove();
        }
        catch (error) {
            console.error('[CloudbaseService.removeWhere] failed:', { where, error });
            throw error;
        }
    }
    nowIso() {
        return new Date().toISOString();
    }
};
exports.CloudbaseService = CloudbaseService;
exports.CloudbaseService = CloudbaseService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], CloudbaseService);
//# sourceMappingURL=cloudbase.service.js.map
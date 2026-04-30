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
exports.SaveService = void 0;
const common_1 = require("@nestjs/common");
const mongo_service_1 = require("../../shared/mongo/mongo.service");
let SaveService = class SaveService {
    constructor(mongoService) {
        this.mongoService = mongoService;
    }
    async getSaveByAccountId(accountId) {
        const collection = this.mongoService.playerSaves();
        const save = (await this.mongoService.findOne(collection, {
            accountId,
        }));
        if (!save?.saveData) {
            return {
                success: true,
                message: 'No cloud save found',
                saveData: null,
            };
        }
        return {
            success: true,
            message: 'Cloud save loaded',
            saveData: {
                version: save.version,
                timestamp: save.lastSaveTime,
                data: save.saveData,
            },
        };
    }
    async upsertSave(user, dto) {
        const wrapper = dto.saveData || {};
        const data = wrapper.data || {};
        const lastSaveTime = Number(data.lastSaveTime || wrapper.timestamp || Date.now());
        const accountId = 'id' in user ? user.id : user._id;
        const collection = this.mongoService.playerSaves();
        const existing = (await this.mongoService.findOne(collection, {
            accountId,
        }));
        const now = this.mongoService.nowIso();
        if (existing?._id && Number(existing.lastSaveTime || 0) > lastSaveTime) {
            return {
                success: true,
                message: 'Cloud save kept because remote data is newer',
                saveData: {
                    version: existing.version,
                    timestamp: existing.lastSaveTime,
                    data: existing.saveData,
                },
            };
        }
        if (existing?._id) {
            await this.mongoService.updateById(collection, existing._id, {
                version: wrapper.version || '2.0.0',
                lastSaveTime,
                saveData: data,
                updatedAt: now,
            });
        }
        else {
            await this.mongoService.insert(collection, {
                accountId,
                version: wrapper.version || '2.0.0',
                lastSaveTime,
                saveData: data,
                createdAt: now,
                updatedAt: now,
            });
        }
        return {
            success: true,
            message: 'Cloud save updated',
            saveData: {
                version: wrapper.version || '2.0.0',
                timestamp: lastSaveTime,
                data,
            },
        };
    }
    async deleteSave(accountId) {
        const collection = this.mongoService.playerSaves();
        await this.mongoService.removeWhere(collection, { accountId });
        return {
            success: true,
            message: 'Cloud save deleted',
        };
    }
};
exports.SaveService = SaveService;
exports.SaveService = SaveService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [mongo_service_1.MongoService])
], SaveService);
//# sourceMappingURL=save.service.js.map
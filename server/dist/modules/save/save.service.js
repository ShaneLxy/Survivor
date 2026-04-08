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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaveService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const player_save_entity_1 = require("./entities/player-save.entity");
let SaveService = class SaveService {
    constructor(saveRepository) {
        this.saveRepository = saveRepository;
    }
    async getSaveByAccountId(accountId) {
        const save = await this.saveRepository.findOne({ where: { accountId } });
        if (!save?.saveData) {
            return {
                success: true,
                message: '云端暂无存档',
                saveData: null,
            };
        }
        return {
            success: true,
            message: '获取云存档成功',
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
        let save = await this.saveRepository.findOne({ where: { accountId: user.id } });
        if (!save) {
            save = this.saveRepository.create({
                accountId: user.id,
                account: user,
            });
        }
        save.version = wrapper.version || '2.0.0';
        save.lastSaveTime = lastSaveTime;
        save.saveData = data;
        await this.saveRepository.save(save);
        return {
            success: true,
            message: '云存档保存成功',
            saveData: {
                version: save.version,
                timestamp: save.lastSaveTime,
                data: save.saveData,
            },
        };
    }
    async deleteSave(accountId) {
        await this.saveRepository.delete({ accountId });
        return {
            success: true,
            message: '云存档已删除',
        };
    }
};
exports.SaveService = SaveService;
exports.SaveService = SaveService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(player_save_entity_1.PlayerSave)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], SaveService);
//# sourceMappingURL=save.service.js.map
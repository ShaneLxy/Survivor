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
exports.CdkeyService = void 0;
const common_1 = require("@nestjs/common");
const cloudbase_service_1 = require("../../shared/cloudbase/cloudbase.service");
let CdkeyService = class CdkeyService {
    constructor(cloudbaseService) {
        this.cloudbaseService = cloudbaseService;
    }
    async redeem(accountId, rawCode) {
        const code = String(rawCode || '').trim().toUpperCase();
        if (!code) {
            throw new common_1.BadRequestException('请输入兑换码');
        }
        const collection = this.cloudbaseService.cdkeys();
        const entity = (await this.cloudbaseService.findOne(collection, { code }));
        if (!entity) {
            return { success: false, message: '兑换码不存在', rewards: [] };
        }
        if (entity.used) {
            return { success: false, message: '兑换码已被使用', rewards: [] };
        }
        if (this.isExpired(entity.expireAt)) {
            return { success: false, message: '兑换码已过期', rewards: [] };
        }
        const now = this.cloudbaseService.nowIso();
        await this.cloudbaseService.updateById(collection, entity._id, {
            used: true,
            usedByAccountId: accountId,
            usedAt: now,
            updatedAt: now,
        });
        return {
            success: true,
            message: '兑换成功',
            rewards: this.normalizeRewards(entity.rewards),
            cdkey: {
                id: entity._id,
                code: entity.code,
                title: entity.title || null,
            },
        };
    }
    isExpired(expireAt) {
        if (!expireAt) {
            return false;
        }
        return Date.parse(String(expireAt)) <= Date.now();
    }
    normalizeRewards(rewards) {
        return (Array.isArray(rewards) ? rewards : [])
            .map((entry) => ({
            type: (entry?.type === 'resource' ? 'resource' : 'item'),
            id: String(entry?.id || ''),
            amount: Math.max(0, Number(entry?.amount) || 0),
        }))
            .filter((entry) => entry.id && entry.amount > 0);
    }
};
exports.CdkeyService = CdkeyService;
exports.CdkeyService = CdkeyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [cloudbase_service_1.CloudbaseService])
], CdkeyService);
//# sourceMappingURL=cdkey.service.js.map
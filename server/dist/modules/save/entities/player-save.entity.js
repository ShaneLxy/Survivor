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
exports.PlayerSave = void 0;
const typeorm_1 = require("typeorm");
const user_account_entity_1 = require("../../users/entities/user-account.entity");
let PlayerSave = class PlayerSave {
};
exports.PlayerSave = PlayerSave;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], PlayerSave.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', unique: true }),
    __metadata("design:type", Number)
], PlayerSave.prototype, "accountId", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => user_account_entity_1.UserAccount, (account) => account.playerSave, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'accountId' }),
    __metadata("design:type", user_account_entity_1.UserAccount)
], PlayerSave.prototype, "account", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16, default: '2.0.0' }),
    __metadata("design:type", String)
], PlayerSave.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], PlayerSave.prototype, "saveData", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', default: 0 }),
    __metadata("design:type", Number)
], PlayerSave.prototype, "lastSaveTime", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], PlayerSave.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], PlayerSave.prototype, "updatedAt", void 0);
exports.PlayerSave = PlayerSave = __decorate([
    (0, typeorm_1.Entity)('player_saves')
], PlayerSave);
//# sourceMappingURL=player-save.entity.js.map
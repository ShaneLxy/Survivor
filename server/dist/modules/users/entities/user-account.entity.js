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
exports.UserAccount = void 0;
const typeorm_1 = require("typeorm");
const player_save_entity_1 = require("../../save/entities/player-save.entity");
let UserAccount = class UserAccount {
};
exports.UserAccount = UserAccount;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], UserAccount.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, unique: true, nullable: true }),
    __metadata("design:type", String)
], UserAccount.prototype, "account", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], UserAccount.prototype, "passwordHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, default: 'local' }),
    __metadata("design:type", String)
], UserAccount.prototype, "loginType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", String)
], UserAccount.prototype, "nickname", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 128, nullable: true, unique: true }),
    __metadata("design:type", String)
], UserAccount.prototype, "wechatOpenId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 128, nullable: true, unique: true }),
    __metadata("design:type", String)
], UserAccount.prototype, "wechatUnionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], UserAccount.prototype, "lastLoginAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], UserAccount.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], UserAccount.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => player_save_entity_1.PlayerSave, (playerSave) => playerSave.account),
    __metadata("design:type", player_save_entity_1.PlayerSave)
], UserAccount.prototype, "playerSave", void 0);
exports.UserAccount = UserAccount = __decorate([
    (0, typeorm_1.Entity)('user_accounts')
], UserAccount);
//# sourceMappingURL=user-account.entity.js.map
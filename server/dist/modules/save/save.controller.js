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
exports.SaveController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const upsert_save_dto_1 = require("./dto/upsert-save.dto");
const save_service_1 = require("./save.service");
let SaveController = class SaveController {
    constructor(saveService) {
        this.saveService = saveService;
    }
    getSave(req) {
        return this.saveService.getSaveByAccountId(req.user.id);
    }
    save(req, dto) {
        return this.saveService.upsertSave(req.user, dto);
    }
    deleteSave(req) {
        return this.saveService.deleteSave(req.user.id);
    }
};
exports.SaveController = SaveController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SaveController.prototype, "getSave", null);
__decorate([
    (0, common_1.Put)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, upsert_save_dto_1.UpsertSaveDto]),
    __metadata("design:returntype", void 0)
], SaveController.prototype, "save", null);
__decorate([
    (0, common_1.Delete)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SaveController.prototype, "deleteSave", null);
exports.SaveController = SaveController = __decorate([
    (0, common_1.Controller)('save'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [save_service_1.SaveService])
], SaveController);
//# sourceMappingURL=save.controller.js.map
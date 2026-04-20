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
exports.MailController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const mail_service_1 = require("./mail.service");
let MailController = class MailController {
    constructor(mailService) {
        this.mailService = mailService;
    }
    list(req) {
        return this.mailService.listMails(req.user.id);
    }
    claimAll(req) {
        return this.mailService.claimAll(req.user.id);
    }
    markRead(req, mailId) {
        return this.mailService.markRead(req.user.id, mailId);
    }
    claim(req, mailId) {
        return this.mailService.claim(req.user.id, mailId);
    }
};
exports.MailController = MailController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MailController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('claim-all'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MailController.prototype, "claimAll", null);
__decorate([
    (0, common_1.Post)(':mailId/read'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('mailId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MailController.prototype, "markRead", null);
__decorate([
    (0, common_1.Post)(':mailId/claim'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('mailId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MailController.prototype, "claim", null);
exports.MailController = MailController = __decorate([
    (0, common_1.Controller)('mail'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [mail_service_1.MailService])
], MailController);
//# sourceMappingURL=mail.controller.js.map
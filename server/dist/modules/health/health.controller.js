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
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let HealthController = class HealthController {
    constructor(configService) {
        this.configService = configService;
    }
    check() {
        return {
            success: true,
            message: 'Survivor server is running',
            timestamp: Date.now(),
        };
    }
    getVersionPolicy() {
        const defaultVersion = this.configService.get('FRONTEND_BUILD_VERSION') || '2026.04.17.1';
        const createPolicy = (prefix, fallbackForce = false) => ({
            latestVersion: this.configService.get(`${prefix}_VERSION_LATEST`) || defaultVersion,
            minSupportedVersion: this.configService.get(`${prefix}_VERSION_MIN`) || defaultVersion,
            forceUpdate: (this.configService.get(`${prefix}_VERSION_FORCE`) || String(fallbackForce)).toLowerCase() === 'true',
            downloadUrl: this.configService.get(`${prefix}_UPDATE_URL`) || '',
            message: this.configService.get(`${prefix}_UPDATE_MESSAGE`) || '',
        });
        return {
            success: true,
            timestamp: Date.now(),
            platforms: {
                web: createPolicy('WEB'),
                android: createPolicy('ANDROID'),
                wechatWeb: createPolicy('WECHAT_WEB'),
                wechatMiniProgram: createPolicy('WECHAT_MINI_PROGRAM'),
            },
        };
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "check", null);
__decorate([
    (0, common_1.Get)('version'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "getVersionPolicy", null);
exports.HealthController = HealthController = __decorate([
    (0, common_1.Controller)('health'),
    __metadata("design:paramtypes", [config_1.ConfigService])
], HealthController);
//# sourceMappingURL=health.controller.js.map
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CdkeyModule = void 0;
const common_1 = require("@nestjs/common");
const cdkey_controller_1 = require("./cdkey.controller");
const cdkey_service_1 = require("./cdkey.service");
let CdkeyModule = class CdkeyModule {
};
exports.CdkeyModule = CdkeyModule;
exports.CdkeyModule = CdkeyModule = __decorate([
    (0, common_1.Module)({
        controllers: [cdkey_controller_1.CdkeyController],
        providers: [cdkey_service_1.CdkeyService],
        exports: [cdkey_service_1.CdkeyService],
    })
], CdkeyModule);
//# sourceMappingURL=cdkey.module.js.map
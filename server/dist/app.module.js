"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const auth_module_1 = require("./modules/auth/auth.module");
const health_controller_1 = require("./modules/health/health.controller");
const save_module_1 = require("./modules/save/save.module");
const player_save_entity_1 = require("./modules/save/entities/player-save.entity");
const user_account_entity_1 = require("./modules/users/entities/user-account.entity");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['.env.local', '.env'],
            }),
            typeorm_1.TypeOrmModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (configService) => {
                    const dbType = (configService.get('DB_TYPE') || 'mysql');
                    const synchronize = String(configService.get('DB_SYNC') ?? 'true') !== 'false';
                    const entities = [user_account_entity_1.UserAccount, player_save_entity_1.PlayerSave];
                    if (dbType === 'sqlite') {
                        return {
                            type: 'sqlite',
                            database: configService.get('SQLITE_PATH') || './data/survivor.db',
                            entities,
                            synchronize,
                        };
                    }
                    return {
                        type: 'mysql',
                        host: configService.get('DB_HOST') || '127.0.0.1',
                        port: Number(configService.get('DB_PORT') || 3306),
                        username: configService.get('DB_USERNAME') || 'root',
                        password: configService.get('DB_PASSWORD') || '',
                        database: configService.get('DB_NAME') || 'survivor_game',
                        entities,
                        synchronize,
                        autoLoadEntities: true,
                    };
                },
            }),
            auth_module_1.AuthModule,
            save_module_1.SaveModule,
        ],
        controllers: [health_controller_1.HealthController],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map
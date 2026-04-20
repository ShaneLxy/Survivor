"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
process.on('uncaughtException', (error) => {
    console.error('[process] uncaughtException:', error);
});
process.on('unhandledRejection', (reason) => {
    console.error('[process] unhandledRejection:', reason);
});
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { cors: true });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
    }));
    const port = Number(process.env.PORT || 9000);
    await app.listen(port, '0.0.0.0');
    console.log(`Survivor server running at http://0.0.0.0:${port}/api`);
}
bootstrap();
//# sourceMappingURL=main.js.map
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { CdkeyModule } from './modules/cdkey/cdkey.module';
import { GmModule } from './modules/gm/gm.module';
import { HealthController } from './modules/health/health.controller';
import { MailModule } from './modules/mail/mail.module';
import { SaveModule } from './modules/save/save.module';
import { MongoModule } from './shared/mongo/mongo.module';

const selectedEnvFile = process.env.ENV_FILE || '.env.local';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [selectedEnvFile, '.env.local', '.env'],
    }),
    // 默认全局限流：每分钟 60 次/IP（auth、save 等敏感接口在 controller 上单独覆盖）
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 60,
      },
    ]),
    MongoModule,
    AuthModule,
    CdkeyModule,
    GmModule,
    SaveModule,
    MailModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

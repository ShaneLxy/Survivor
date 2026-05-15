import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
    MongoModule,
    AuthModule,
    CdkeyModule,
    GmModule,
    SaveModule,
    MailModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

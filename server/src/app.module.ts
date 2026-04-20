import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { CdkeyModule } from './modules/cdkey/cdkey.module';
import { HealthController } from './modules/health/health.controller';
import { MailModule } from './modules/mail/mail.module';
import { SaveModule } from './modules/save/save.module';
import { CloudbaseModule } from './shared/cloudbase/cloudbase.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    CloudbaseModule,
    AuthModule,
    CdkeyModule,
    SaveModule,
    MailModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

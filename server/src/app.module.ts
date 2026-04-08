import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { HealthController } from './modules/health/health.controller';
import { SaveModule } from './modules/save/save.module';
import { PlayerSave } from './modules/save/entities/player-save.entity';
import { UserAccount } from './modules/users/entities/user-account.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        const dbType = (configService.get<string>('DB_TYPE') || 'mysql') as 'mysql' | 'sqlite';
        const synchronize = String(configService.get('DB_SYNC') ?? 'true') !== 'false';
        const entities = [UserAccount, PlayerSave];

        if (dbType === 'sqlite') {
          return {
            type: 'sqlite',
            database: configService.get<string>('SQLITE_PATH') || './data/survivor.db',
            entities,
            synchronize,
          };
        }

        return {
          type: 'mysql',
          host: configService.get<string>('DB_HOST') || '127.0.0.1',
          port: Number(configService.get<string>('DB_PORT') || 3306),
          username: configService.get<string>('DB_USERNAME') || 'root',
          password: configService.get<string>('DB_PASSWORD') || '',
          database: configService.get<string>('DB_NAME') || 'survivor_game',
          entities,
          synchronize,
          autoLoadEntities: true,
        };
      },
    }),
    AuthModule,
    SaveModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

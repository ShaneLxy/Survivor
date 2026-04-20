import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

process.on('uncaughtException', (error) => {
  console.error('[process] uncaughtException:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandledRejection:', reason);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = Number(process.env.PORT || 9000);
  await app.listen(port, '0.0.0.0');
  console.log(`Survivor server running at http://0.0.0.0:${port}/api`);
}

bootstrap();

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
  app.use((req: any, res: any, next: () => void) => {
    const serverTime = new Date().toISOString();
    res.setHeader('X-Server-Time', serverTime);
    const previousExposeHeaders = String(res.getHeader('Access-Control-Expose-Headers') || '')
      .split(',')
      .map((item: string) => item.trim())
      .filter(Boolean);
    if (!previousExposeHeaders.includes('X-Server-Time')) {
      previousExposeHeaders.push('X-Server-Time');
    }
    res.setHeader('Access-Control-Expose-Headers', previousExposeHeaders.join(', '));
    next();
  });
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

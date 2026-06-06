import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

process.on('uncaughtException', (error) => {
  console.error('[process] uncaughtException:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandledRejection:', reason);
});

async function bootstrap() {
  // 禁用 Nest 默认 bodyParser，使用显式配置（控制请求体大小上限）
  const app = await NestFactory.create(AppModule, {
    cors: true,
    bodyParser: false,
  });

  // 请求体大小上限：saveData 正常 50-200KB，512KB 留 2-3 倍余量同时挡住巨型 payload 攻击
  app.use(json({ limit: '512kb' }));
  app.use(urlencoded({ extended: true, limit: '512kb' }));

  // 信任反向代理（Cloudflare Tunnel / Nginx 等）转发的 X-Forwarded-For
  // 让 req.ip 反映真实客户端 IP，否则速率限制会把所有请求归到同一个代理 IP
  const expressInstance: any = app.getHttpAdapter().getInstance();
  if (expressInstance?.set) {
    expressInstance.set('trust proxy', 1);
  }

  // HTTPS 强制：ENFORCE_HTTPS=true 时拒绝非 HTTPS 请求
  // 通过 X-Forwarded-Proto 判断（生产环境需在反向代理处设此 header）
  // 本地开发不要开启此环境变量
  const enforceHttps = String(process.env.ENFORCE_HTTPS || '').toLowerCase() === 'true';
  if (enforceHttps) {
    app.use((req: any, res: any, next: () => void) => {
      const forwardedProto = String(req.headers?.['x-forwarded-proto'] || '')
        .split(',')[0]
        .trim()
        .toLowerCase();
      const isSecure = forwardedProto === 'https' || req.secure === true;
      if (!isSecure) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            code: 'HTTPS_REQUIRED',
            message: '当前环境要求使用 HTTPS 访问',
          }),
        );
        return;
      }
      next();
    });
  }

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

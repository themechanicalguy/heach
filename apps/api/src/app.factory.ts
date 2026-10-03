import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { EnvVars, NodeEnv } from './config/env.schema.js';

/** Builds the app with all global setup, shared by main.ts and integration tests. */
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const env = app.get(EnvVars);

  app.disable('x-powered-by');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  if (env.NODE_ENV !== NodeEnv.Production) {
    setUpOpenApi(app, env);
  }
  return app;
}

function setUpOpenApi(app: INestApplication, env: EnvVars): void {
  const config = new DocumentBuilder()
    .setTitle('HEACH API')
    .setVersion(env.BUILD_VERSION ?? 'dev')
    .build();
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config));
}

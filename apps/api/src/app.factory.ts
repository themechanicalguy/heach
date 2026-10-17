import {
  BadRequestException,
  type INestApplication,
  type LoggerService,
  type LogLevel,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { correlationMiddleware } from './common/correlation.middleware.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { EnvVars, NodeEnv } from './config/env.schema.js';
import { validateEnv } from './config/env.validate.js';
import { buildOpenApiDocument } from './openapi.js';

/** Builds the app with all global setup, shared by main.ts and integration tests. */
export async function createApp(
  options: { logger?: LoggerService | LogLevel[] | false } = {},
): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.forEnv(validateEnv(process.env).APP_ENV),
    {
      logger: options.logger ?? ['error', 'warn', 'log'],
    },
  );
  const env = app.get(EnvVars);

  app.disable('x-powered-by');
  // One proxy (Caddy) in front: req.ip is the client address, used for rate limits (SO-08.1).
  app.set('trust proxy', 1);
  app.use(correlationMiddleware);
  app.use(securityHeaders());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // Never echo input, field names or values, back to the caller (SO-05.2).
      exceptionFactory: () => new BadRequestException('Invalid request'),
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  if (env.NODE_ENV !== NodeEnv.Production) {
    setUpOpenApi(app, env);
  }
  return app;
}

function setUpOpenApi(app: INestApplication, env: EnvVars): void {
  SwaggerModule.setup('docs', app, () => buildOpenApiDocument(app, env.BUILD_VERSION ?? 'dev'));
}

/** CSP without inline scripts, HSTS for a year, no framing, no sniffing (SO-05.1, EN-01.2). */
function securityHeaders(): ReturnType<typeof helmet> {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    strictTransportSecurity: { maxAge: 31_536_000, includeSubDomains: true },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
}

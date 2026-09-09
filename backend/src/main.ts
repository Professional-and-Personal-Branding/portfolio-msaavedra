import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { APP_CONFIG, AppConfig } from './config/configuration';
import { GLOBAL_PREFIX, PREFIX_EXCLUDED_ROUTES } from './app.constants';
import { buildCorsOptions } from './shared/infrastructure/http/cors.options';
import { requestIdMiddleware } from './shared/infrastructure/http/request-id';
import { buildHelmet, httpsRedirect } from './shared/infrastructure/http/security.middleware';
import { setupSwagger, shouldPublishDocs } from './swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  const logger = new Logger('Bootstrap');

  const config = app.get(ConfigService).getOrThrow<AppConfig>(APP_CONFIG);

  // Primero de todo: el id lo usan el logger de peticiones y el filtro de errores.
  app.use(requestIdMiddleware);
  // Detrás del proxy del proveedor: habilita X-Forwarded-Proto y la IP real del cliente.
  app.set('trust proxy', 1);
  app.use(httpsRedirect(config.isProduction));
  app.use(buildHelmet(config.isProduction));

  // El healthcheck vive fuera de /api: es lo que consulta el orquestador (spec `api-health`).
  app.setGlobalPrefix(GLOBAL_PREFIX, { exclude: PREFIX_EXCLUDED_ROUTES });
  // Cookie de sesión del backoffice (spec `admin-authentication`).
  app.use(cookieParser());
  // Global: solo transform. El whitelist/forbidNonWhitelisted vive en los controllers con cuerpo
  // (adminValidationPipe): un pipe global con whitelist correría antes y borraría los campos
  // desconocidos sin dar 400.
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.enableCors(buildCorsOptions(config.frontendUrl));
  app.enableShutdownHooks();

  const docsPublished = shouldPublishDocs(config.nodeEnv, process.env.ENABLE_API_DOCS);
  if (docsPublished) setupSwagger(app);

  await app.listen(config.port);
  logger.log(`API escuchando en http://localhost:${config.port}/${GLOBAL_PREFIX}`);
  logger.log(
    docsPublished
      ? `Swagger en http://localhost:${config.port}/${GLOBAL_PREFIX}/docs`
      : 'Swagger deshabilitado (producción sin ENABLE_API_DOCS)',
  );
}

function handleFatal(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  // Fail-fast: sin configuración válida o sin base de datos, la API no arranca.
  console.error(`[Bootstrap] La API no pudo arrancar: ${message}`);
  process.exit(1);
}

if (require.main === module) {
  bootstrap().catch(handleFatal);
}

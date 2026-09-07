import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { APP_CONFIG, AppConfig } from './config/configuration';
import { GLOBAL_PREFIX } from './app.constants';
import { buildCorsOptions } from './shared/infrastructure/http/cors.options';
import { setupSwagger } from './swagger';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(logger);

  const config = app.get(ConfigService).getOrThrow<AppConfig>(APP_CONFIG);

  app.setGlobalPrefix(GLOBAL_PREFIX);
  // Global: solo transform. El whitelist/forbidNonWhitelisted vive en los controllers con cuerpo
  // (adminValidationPipe): un pipe global con whitelist correría antes y borraría los campos
  // desconocidos sin dar 400.
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.enableCors(buildCorsOptions(config.frontendUrl));
  app.enableShutdownHooks();

  setupSwagger(app);

  await app.listen(config.port);
  logger.log(`API escuchando en http://localhost:${config.port}/${GLOBAL_PREFIX}`);
  logger.log(`Swagger en http://localhost:${config.port}/${GLOBAL_PREFIX}/docs`);
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

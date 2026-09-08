/**
 * Exporta el contrato OpenAPI a `backend/openapi.json` sin levantar servidor ni
 * conectar a la base (spec `api-contract-types`, decisión D2 de
 * `add-public-frontend-theming`). El frontend genera sus tipos desde este archivo.
 *
 * Crea la app sin `init()`/`listen()`: los providers se instancian pero
 * `PrismaService.onModuleInit` (que conecta) nunca se ejecuta. Las variables de
 * entorno obligatorias reciben valores de relleno si faltan, porque el documento
 * no depende de ellas.
 *
 * Uso: npm run openapi:export  → exit 0 y escribe openapi.json; 1 si falla.
 */
import { NestFactory } from '@nestjs/core';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { GLOBAL_PREFIX } from '../src/app.constants';
import { buildOpenApiDocument } from '../src/swagger';

const OUTPUT_PATH = path.resolve(__dirname, '../openapi.json');

const ENV_FALLBACKS: Record<string, string | undefined> = {
  DATABASE_URL: 'postgresql://export:export@localhost:5432/export',
  JWT_SECRET: 'openapi-export-placeholder-secret',
  PORT: undefined, // vacío en algunos shells; sin valor aplica el default (3000)
};

async function main(): Promise<void> {
  for (const [key, value] of Object.entries(ENV_FALLBACKS)) {
    if (process.env[key]) continue;
    delete process.env[key];
    if (value !== undefined) process.env[key] = value;
  }

  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  app.setGlobalPrefix(GLOBAL_PREFIX);

  const document = buildOpenApiDocument(app);
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(document, null, 2)}\n`, 'utf-8');

  const pathCount = Object.keys(document.paths).length;
  const schemaCount = Object.keys(document.components?.schemas ?? {}).length;
  console.log(
    `OpenAPI exportado a ${path.relative(process.cwd(), OUTPUT_PATH)}: ${pathCount} rutas, ${schemaCount} schemas`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[openapi:export] Falló la exportación: ${message}`);
  process.exit(1);
});

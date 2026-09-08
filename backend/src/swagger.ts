import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'api/docs';
export const SWAGGER_JSON_PATH = 'api/docs-json';

/**
 * Construye el documento OpenAPI a partir de la app (sin publicarlo). Lo usan
 * `setupSwagger` y `scripts/export-openapi.ts`, así el JSON versionado en
 * `backend/openapi.json` es idéntico al servido en `/api/docs-json`
 * (spec `api-contract-types`).
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Portafolio Administrable — API')
    .setDescription(
      'API pública del portafolio profesional de Manuel Saavedra. ' +
        'Todas las respuestas se sirven en el idioma negociado: `?locale=` > `?lang=` > `Accept-Language` > `es`.',
    )
    .setVersion('0.1.0')
    .addTag('profile', 'Perfil profesional base')
    .addTag('experiences', 'Trayectoria laboral')
    .addTag('curated-profiles', 'Perfiles curados (núcleo del producto)')
    .addTag(
      'sections',
      'Secciones del portafolio: educación, certificaciones, proyectos, presencia pública',
    )
    .addTag('auth', 'Autenticación del backoffice')
    .addTag('admin', 'Backoffice (requiere Bearer JWT)')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();

  return SwaggerModule.createDocument(app, config);
}

/** Publica la UI en /api/docs y el documento OpenAPI en /api/docs-json (spec `api-platform`). */
export function setupSwagger(app: INestApplication): void {
  const document = buildOpenApiDocument(app);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    jsonDocumentUrl: SWAGGER_JSON_PATH,
    customSiteTitle: 'Portafolio API — Docs',
  });
}

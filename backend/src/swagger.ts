import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'api/docs';
export const SWAGGER_JSON_PATH = 'api/docs-json';

/** Publica la UI en /api/docs y el documento OpenAPI en /api/docs-json (spec `api-platform`). */
export function setupSwagger(app: INestApplication): void {
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
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    jsonDocumentUrl: SWAGGER_JSON_PATH,
    customSiteTitle: 'Portafolio API — Docs',
  });
}

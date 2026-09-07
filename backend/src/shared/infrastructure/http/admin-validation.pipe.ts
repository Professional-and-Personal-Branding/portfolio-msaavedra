import { ValidationPipe } from '@nestjs/common';

/**
 * ValidationPipe para rutas del backoffice: además de `whitelist` + `transform`
 * (globales), rechaza campos desconocidos (spec `admin-*-crud`).
 * Las rutas públicas mantienen tolerancia a parámetros extra.
 */
export const adminValidationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: false },
});

import { HttpException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { DomainError, NotFoundError } from '../../domain/errors';

/**
 * Traduce errores de dominio (devueltos en un Result) a excepciones HTTP de NestJS.
 * Las HttpException de Nest producen el cuerpo `{ statusCode, message, error }`
 * exigido por la spec `api-platform`, sin stack traces.
 */
export function toHttpException(error: DomainError): HttpException {
  if (error instanceof NotFoundError) {
    return new NotFoundException(error.message);
  }
  // Nunca exponer detalles internos de errores no previstos.
  return new InternalServerErrorException('Error interno');
}

import {
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AccessDeniedError, DomainError, NotFoundError } from '../../domain/errors';

/**
 * Traduce errores de dominio (devueltos en un Result) a excepciones HTTP de NestJS.
 * Las HttpException de Nest producen el cuerpo `{ statusCode, message, error }`
 * exigido por la spec `api-platform`, sin stack traces.
 */
export function toHttpException(error: DomainError): HttpException {
  if (error instanceof NotFoundError) {
    return new NotFoundException(error.message);
  }
  if (error instanceof AccessDeniedError) {
    // 401: el remedio es presentar la credencial (token de acceso).
    return new UnauthorizedException(error.message);
  }
  // Nunca exponer detalles internos de errores no previstos.
  return new InternalServerErrorException('Error interno');
}

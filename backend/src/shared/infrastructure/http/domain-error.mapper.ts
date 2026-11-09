import {
  BadRequestException,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AccessDeniedError,
  ConflictError,
  DomainError,
  NotFoundError,
  RuleViolationError,
  ValidationError,
} from '../../domain/errors';

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
    // 401: el remedio es presentar la credencial (token de acceso / JWT).
    return new UnauthorizedException(error.message);
  }
  if (error instanceof ValidationError) {
    return new BadRequestException(error.message);
  }
  if (error instanceof ConflictError) {
    return new ConflictException(error.message);
  }
  if (error instanceof RuleViolationError) {
    // 422: la petición es válida de forma pero el estado actual no admite la operación.
    return new UnprocessableEntityException(error.message);
  }
  // Nunca exponer detalles internos de errores no previstos.
  return new InternalServerErrorException('Error interno');
}

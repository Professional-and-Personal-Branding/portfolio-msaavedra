import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { getRequestId } from './request-id';

/** Cuerpo uniforme de error (spec `api-platform` § Manejo global de errores). */
export interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  requestId?: string;
  timestamp: string;
}

/** Umbral de error del servidor, como número: `status` viene sin el tipo del enum. */
const SERVER_ERROR: number = HttpStatus.INTERNAL_SERVER_ERROR;

const GENERIC_MESSAGE = 'Error interno del servidor';
const GENERIC_ERROR = 'Internal Server Error';

/**
 * Red de seguridad para **todo** lo que llegue sin atrapar: unifica la forma del
 * error, agrega `requestId` y `timestamp`, y garantiza que nunca salgan stack
 * traces, rutas del servidor ni detalles de la base.
 *
 * Los errores de dominio ya llegan como `HttpException` (ver `toHttpException`)
 * y conservan su status y su mensaje de negocio.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const requestId = getRequestId(request);

    const { status, message, error } = this.describe(exception);
    const body: ErrorBody = {
      statusCode: status,
      message,
      error,
      ...(requestId ? { requestId } : {}),
      timestamp: new Date().toISOString(),
    };

    this.log(exception, status, request, requestId);

    if (response.headersSent) return;
    response.status(status).json(body);
  }

  /** Traduce la excepción a status y textos seguros para el cliente. */
  private describe(exception: unknown): {
    status: number;
    message: string | string[];
    error: string;
  } {
    if (!(exception instanceof HttpException)) {
      return { status: SERVER_ERROR, message: GENERIC_MESSAGE, error: GENERIC_ERROR };
    }

    const status: number = exception.getStatus();
    // Un 5xx previsto tampoco debe contar por qué falló.
    if (status >= SERVER_ERROR) {
      return { status, message: GENERIC_MESSAGE, error: GENERIC_ERROR };
    }

    const payload = exception.getResponse();
    if (typeof payload === 'string') {
      return { status, message: payload, error: defaultErrorName(status) };
    }

    const record = payload as { message?: unknown; error?: unknown };
    return {
      status,
      message: toMessage(record.message) ?? exception.message,
      error: typeof record.error === 'string' ? record.error : defaultErrorName(status),
    };
  }

  /** 5xx con detalle completo (incluido el stack) al log; 4xx en una línea. */
  private log(exception: unknown, status: number, request: Request, requestId?: string): void {
    const context = `${request.method} ${request.url}${requestId ? ` [${requestId}]` : ''}`;

    if (status >= SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`${context} → ${status}`, stack);
      return;
    }
    const detail = exception instanceof Error ? exception.message : String(exception);
    this.logger.warn(`${context} → ${status}: ${detail}`);
  }
}

function toMessage(value: unknown): string | string[] | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value;
  }
  return undefined;
}

/** Nombre estándar del status, para los casos en que la excepción no lo trae. */
const ERROR_NAMES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
};

function defaultErrorName(status: number): string {
  return ERROR_NAMES[status] ?? GENERIC_ERROR;
}

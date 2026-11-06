import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { APP_CONFIG, AppConfig } from '../../../../config/configuration';

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Ventana fija en memoria por IP, compartida en algoritmo (no en contador) por el límite del login
 * y el del cambio de contraseña (spec `api-rate-limiting` § Límite reforzado). Cada guard instancia
 * la suya, así los intentos de uno no restan cupo al otro.
 *
 * El almacenamiento es en memoria: correcto con una instancia. Escalar a varias
 * pediría un almacén compartido (ver `design.md` § Risks).
 */
export class CredentialAttemptLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly config: ConfigService,
    /** Mensaje del 429 de este límite. */
    private readonly message: string,
  ) {}

  /** Cuenta un intento; devuelve `true` o lanza 429 con `Retry-After`. */
  consume(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const { throttle } = this.config.getOrThrow<AppConfig>(APP_CONFIG);

    const key = request.ip ?? 'desconocida';
    const now = Date.now();
    const ttlMs = throttle.ttl * 1000;
    const window = this.windows.get(key);

    if (!window || window.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + ttlMs });
      this.evictExpired(now);
      return true;
    }

    window.count += 1;
    if (window.count <= throttle.loginLimit) return true;

    const retryAfter = Math.max(1, Math.ceil((window.resetAt - now) / 1000));
    http.getResponse<Response>().setHeader('Retry-After', String(retryAfter));
    throw new HttpException(this.message, HttpStatus.TOO_MANY_REQUESTS);
  }

  /** Evita que el mapa crezca sin límite con IPs que no vuelven. */
  private evictExpired(now: number): void {
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }
}

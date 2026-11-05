import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CredentialAttemptLimiter } from './credential-attempt-limiter';

/**
 * Límite propio del login (spec `api-rate-limiting` § Límite reforzado).
 * Va aparte del límite global para que los intentos de contraseña se cuenten
 * solos y con su propia ventana, sin interferir con el tráfico normal.
 */
@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  private readonly limiter: CredentialAttemptLimiter;

  constructor(config: ConfigService) {
    this.limiter = new CredentialAttemptLimiter(
      config,
      'Demasiados intentos de inicio de sesión. Probá de nuevo en unos minutos.',
    );
  }

  canActivate(context: ExecutionContext): boolean {
    return this.limiter.consume(context);
  }
}

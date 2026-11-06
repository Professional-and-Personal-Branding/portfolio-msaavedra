import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CredentialAttemptLimiter } from './credential-attempt-limiter';

/**
 * Límite propio de `POST /api/auth/password` (change `add-admin-password-change`, D8): mismos
 * valores que el del login pero con contador independiente. Va después de `JwtAuthGuard`, así una
 * petición anónima da 401 sin consumir el cupo.
 */
@Injectable()
export class PasswordChangeRateLimitGuard implements CanActivate {
  private readonly limiter: CredentialAttemptLimiter;

  constructor(config: ConfigService) {
    this.limiter = new CredentialAttemptLimiter(
      config,
      'Demasiados intentos de cambio de contraseña. Probá de nuevo en unos minutos.',
    );
  }

  canActivate(context: ExecutionContext): boolean {
    return this.limiter.consume(context);
  }
}

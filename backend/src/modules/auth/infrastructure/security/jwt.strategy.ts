import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { APP_CONFIG, AppConfig } from '../../../../config/configuration';
import { AuthenticatedAdmin } from '../../application/dto/auth.output';
import { GetCurrentAdminUseCase } from '../../application/use-cases/get-current-admin.use-case';
import { adminTokenExtractors } from './extract-admin-token';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  /** Versión de sesión; ausente en los tokens emitidos antes de `add-admin-password-change`. */
  sv?: unknown;
  iat?: number;
  exp?: number;
}

/**
 * Valida firma y expiración (passport-jwt) y luego confirma que el
 * administrador siga existiendo y que la versión de sesión (`sv`) siga vigente. Lo devuelto queda en `req.user`.
 * El token se toma del header `Authorization: Bearer` y, si no viene, de la
 * cookie de sesión del backoffice (spec `admin-authentication`).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly getCurrentAdmin: GetCurrentAdminUseCase,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors(adminTokenExtractors),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<AppConfig>(APP_CONFIG).jwt.secret,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedAdmin> {
    if (!payload?.sub) throw new UnauthorizedException('Token inválido');
    const result = await this.getCurrentAdmin.execute({
      id: payload.sub,
      sessionVersion: payload.sv,
    });
    if (!result.ok) throw new UnauthorizedException('Sesión inválida');
    return result.value;
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { APP_CONFIG, AppConfig } from '../../../../config/configuration';
import { AdminOutput } from '../../application/dto/auth.output';
import { GetCurrentAdminUseCase } from '../../application/use-cases/get-current-admin.use-case';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  iat?: number;
  exp?: number;
}

/**
 * Estrategia Bearer: valida firma y expiración (passport-jwt) y luego confirma
 * que el administrador siga existiendo. Lo devuelto queda en `req.user`.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly getCurrentAdmin: GetCurrentAdminUseCase,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<AppConfig>(APP_CONFIG).jwt.secret,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload): Promise<AdminOutput> {
    if (!payload?.sub) throw new UnauthorizedException('Token inválido');
    const result = await this.getCurrentAdmin.execute({ id: payload.sub });
    if (!result.ok) throw new UnauthorizedException('Administrador inexistente');
    return result.value;
  }
}

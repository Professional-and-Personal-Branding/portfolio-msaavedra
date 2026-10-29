import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminSessionVerifier } from '../../../../shared/application/admin-session-verifier';
import { GetCurrentAdminUseCase } from '../../application/use-cases/get-current-admin.use-case';

/**
 * Misma validación que el guard del panel: HS256, firma y expiración con el
 * secreto de la app, y que el administrador siga existiendo. Cualquier error es
 * `false`; el token no se escribe en ningún lado.
 */
@Injectable()
export class JwtAdminSessionVerifier implements AdminSessionVerifier {
  constructor(
    private readonly jwt: JwtService,
    private readonly getCurrentAdmin: GetCurrentAdminUseCase,
  ) {}

  async isAdminSession(token: string): Promise<boolean> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: unknown }>(token, {
        algorithms: ['HS256'],
      });
      if (typeof payload?.sub !== 'string' || payload.sub.length === 0) return false;
      const admin = await this.getCurrentAdmin.execute({ id: payload.sub });
      return admin.ok;
    } catch {
      return false;
    }
  }
}

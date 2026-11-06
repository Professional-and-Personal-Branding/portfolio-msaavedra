import { Inject, Injectable } from '@nestjs/common';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { SessionRevokedError } from '../../domain/errors/session-revoked.error';
import {
  ADMIN_USER_REPOSITORY,
  AdminUserRepository,
} from '../../domain/repositories/admin-user.repository';
import { AuthenticatedAdmin } from '../dto/auth.output';

/**
 * Verificación única de la sesión del panel (change `add-admin-password-change`, D4): la usan
 * el guard (`JwtStrategy`), `GET /api/auth/me` y el reconocimiento de visitas propias. La sesión
 * vale si el administrador existe y el `sv` del token coincide con su `sessionVersion`.
 */
@Injectable()
export class GetCurrentAdminUseCase {
  constructor(@Inject(ADMIN_USER_REPOSITORY) private readonly admins: AdminUserRepository) {}

  async execute(input: {
    id: string;
    /** Claim `sv` del token tal cual venía; `undefined` (token anterior al deploy) vale 0. */
    sessionVersion: unknown;
  }): Promise<Result<AuthenticatedAdmin, SessionRevokedError>> {
    const admin = await this.admins.findById(input.id);
    if (!admin || !admin.acceptsSession(input.sessionVersion))
      return fail(new SessionRevokedError());
    return ok({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      sessionVersion: admin.sessionVersion,
    });
  }
}

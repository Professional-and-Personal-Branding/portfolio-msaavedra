import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '../../../../shared/domain/errors';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { InvalidCurrentPasswordError } from '../../domain/errors/invalid-current-password.error';
import { SessionRevokedError } from '../../domain/errors/session-revoked.error';
import { PASSWORD_HASHER, PasswordHasher } from '../../domain/ports/password-hasher.port';
import { TOKEN_SIGNER, TokenSigner } from '../../domain/ports/token-signer.port';
import {
  ADMIN_USER_REPOSITORY,
  AdminUserRepository,
} from '../../domain/repositories/admin-user.repository';
import { validateNewPassword } from '../../domain/services/validate-new-password';
import { LoginOutput } from '../dto/auth.output';
import { toAdminOutput } from '../mappers/admin-user.mapper';

export interface ChangeAdminPasswordInput {
  adminId: string;
  /** Versión de sesión del token con el que se hizo la petición. */
  sessionVersion: number;
  currentPassword: string;
  newPassword: string;
}

/**
 * Cambia la contraseña del administrador y revoca las demás sesiones (change
 * `add-admin-password-change`, D5): incrementa `sessionVersion` en la misma escritura que el
 * hash y reemite un token con la versión nueva para la sesión que cambia.
 */
@Injectable()
export class ChangeAdminPasswordUseCase {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY) private readonly admins: AdminUserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_SIGNER) private readonly signer: TokenSigner,
  ) {}

  async execute(
    input: ChangeAdminPasswordInput,
  ): Promise<
    Result<LoginOutput, SessionRevokedError | InvalidCurrentPasswordError | ValidationError>
  > {
    const admin = await this.admins.findById(input.adminId);
    if (!admin || !admin.acceptsSession(input.sessionVersion))
      return fail(new SessionRevokedError());

    const matches = await this.hasher.verify(admin.passwordHash, input.currentPassword);
    if (!matches) return fail(new InvalidCurrentPasswordError());

    // Después de verificar la actual: así la comparación con ella no revela nada a un tercero.
    const policy = validateNewPassword(input.newPassword, input.currentPassword);
    if (!policy.ok) return fail(policy.error);

    const passwordHash = await this.hasher.hash(input.newPassword);
    const updated = await this.admins.changePassword(admin.id, passwordHash, admin.sessionVersion);
    // Otra petición cambió la contraseña en el medio: esta sesión ya quedó revocada.
    if (!updated) return fail(new SessionRevokedError());

    const signed = await this.signer.sign({
      sub: updated.id,
      email: updated.email,
      name: updated.name,
      sessionVersion: updated.sessionVersion,
    });
    return ok({
      accessToken: signed.token,
      tokenType: 'Bearer',
      expiresIn: signed.expiresInSeconds,
      user: toAdminOutput(updated),
    });
  }
}

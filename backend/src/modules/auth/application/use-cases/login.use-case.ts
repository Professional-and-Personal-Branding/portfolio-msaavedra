import { Inject, Injectable } from '@nestjs/common';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { InvalidCredentialsError } from '../../domain/errors/invalid-credentials.error';
import { PASSWORD_HASHER, PasswordHasher } from '../../domain/ports/password-hasher.port';
import { TOKEN_SIGNER, TokenSigner } from '../../domain/ports/token-signer.port';
import {
  ADMIN_USER_REPOSITORY,
  AdminUserRepository,
} from '../../domain/repositories/admin-user.repository';
import { LoginOutput } from '../dto/auth.output';
import { toAdminOutput } from '../mappers/admin-user.mapper';

export interface LoginInput {
  email: string;
  password: string;
}

/** Login del backoffice: verifica credenciales y emite un token con caducidad. */
@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY) private readonly admins: AdminUserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_SIGNER) private readonly signer: TokenSigner,
  ) {}

  async execute(input: LoginInput): Promise<Result<LoginOutput, InvalidCredentialsError>> {
    const admin = await this.admins.findByEmail(input.email.trim().toLowerCase());
    if (!admin) return fail(new InvalidCredentialsError());

    const valid = await this.hasher.verify(admin.passwordHash, input.password);
    if (!valid) return fail(new InvalidCredentialsError());

    await this.admins.touchLastLogin(admin.id, new Date());
    const signed = await this.signer.sign({ sub: admin.id, email: admin.email, name: admin.name });

    return ok({
      accessToken: signed.token,
      tokenType: 'Bearer',
      expiresIn: signed.expiresInSeconds,
      user: toAdminOutput(admin),
    });
  }
}

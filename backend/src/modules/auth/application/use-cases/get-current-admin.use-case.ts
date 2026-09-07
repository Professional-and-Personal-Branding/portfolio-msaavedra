import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../../shared/domain/errors';
import { fail, ok, Result } from '../../../../shared/domain/result';
import {
  ADMIN_USER_REPOSITORY,
  AdminUserRepository,
} from '../../domain/repositories/admin-user.repository';
import { AdminOutput } from '../dto/auth.output';
import { toAdminOutput } from '../mappers/admin-user.mapper';

/** Datos del administrador autenticado (para `GET /api/auth/me` y la estrategia JWT). */
@Injectable()
export class GetCurrentAdminUseCase {
  constructor(@Inject(ADMIN_USER_REPOSITORY) private readonly admins: AdminUserRepository) {}

  async execute(input: { id: string }): Promise<Result<AdminOutput, NotFoundError>> {
    const admin = await this.admins.findById(input.id);
    if (!admin) return fail(new NotFoundError('Administrador', input.id));
    return ok(toAdminOutput(admin));
  }
}

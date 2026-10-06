import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '../../../../../shared/domain/errors';
import { Locale } from '../../../../../shared/domain/i18n';
import { fail, ok, Result } from '../../../../../shared/domain/result';
import { ProfileContent } from '../../../domain/entities/profile.entity';
import { ProfileNotFoundError } from '../../../domain/errors/profile-not-found.error';
import {
  PROFILE_REPOSITORY,
  ProfileRepository,
} from '../../../domain/repositories/profile.repository';
import { validateProfileContent } from '../../../domain/services/validate-profile';
import { AdminProfileOutput } from '../../dto/profile.admin-output';
import { ProfileOutput } from '../../dto/profile.output';
import { toAdminProfileOutput } from '../../mappers/profile.admin-mapper';
import { toProfileOutput } from '../../mappers/profile.mapper';

/** El perfil base crudo (bilingüe) para editarlo. Sin id: es un singleton (D1). */
@Injectable()
export class GetProfileAdminUseCase {
  constructor(@Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository) {}

  async execute(): Promise<Result<AdminProfileOutput, ProfileNotFoundError>> {
    const profile = await this.profiles.findOne();
    if (!profile) return fail(new ProfileNotFoundError());
    return ok(toAdminProfileOutput(profile));
  }
}

/**
 * Reemplaza el contenido del perfil base (`PUT`, D1). Valida el estado completo
 * antes de escribir: un perfil inválido nunca llega a los links.
 */
@Injectable()
export class ReplaceProfileUseCase {
  constructor(@Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository) {}

  async execute(
    content: ProfileContent,
  ): Promise<Result<AdminProfileOutput, ProfileNotFoundError | ValidationError>> {
    const valid = validateProfileContent(content);
    if (!valid.ok) return valid;

    const profile = await this.profiles.findOne();
    if (!profile) return fail(new ProfileNotFoundError());

    const saved = await this.profiles.save(profile.withContent(content));
    if (!saved) return fail(new ProfileNotFoundError());
    return ok(toAdminProfileOutput(saved));
  }
}

export interface PreviewProfileInput {
  content: ProfileContent;
  locale: Locale;
}

/**
 * Vista previa del perfil base sin guardar (D4): el contenido del borrador,
 * resuelto al idioma con el mismo mapper que la ruta pública, sobre los idiomas
 * ya guardados. No escribe nada.
 */
@Injectable()
export class PreviewProfileUseCase {
  constructor(@Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository) {}

  async execute(
    input: PreviewProfileInput,
  ): Promise<Result<ProfileOutput, ProfileNotFoundError | ValidationError>> {
    const valid = validateProfileContent(input.content);
    if (!valid.ok) return valid;

    const profile = await this.profiles.findOne();
    if (!profile) return fail(new ProfileNotFoundError());
    return ok(toProfileOutput(profile.withContent(input.content), input.locale));
  }
}

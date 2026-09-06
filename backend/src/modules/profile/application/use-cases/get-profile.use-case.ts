import { Inject, Injectable } from '@nestjs/common';
import { Locale } from '../../../../shared/domain/i18n';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { ProfileNotFoundError } from '../../domain/errors/profile-not-found.error';
import {
  PROFILE_REPOSITORY,
  ProfileRepository,
} from '../../domain/repositories/profile.repository';
import { ProfileOutput } from '../dto/profile.output';
import { toProfileOutput } from '../mappers/profile.mapper';

export interface GetProfileInput {
  locale: Locale;
}

/** Devuelve el perfil base resuelto al idioma pedido. */
@Injectable()
export class GetProfileUseCase {
  constructor(@Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository) {}

  async execute(input: GetProfileInput): Promise<Result<ProfileOutput, ProfileNotFoundError>> {
    const profile = await this.profiles.findOne();
    if (!profile) return fail(new ProfileNotFoundError());
    return ok(toProfileOutput(profile, input.locale));
  }
}

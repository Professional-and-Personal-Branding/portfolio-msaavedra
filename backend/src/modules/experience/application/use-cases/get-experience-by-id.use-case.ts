import { Inject, Injectable } from '@nestjs/common';
import { Locale } from '../../../../shared/domain/i18n';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { ExperienceNotFoundError } from '../../domain/errors/experience-not-found.error';
import {
  EXPERIENCE_REPOSITORY,
  ExperienceRepository,
} from '../../domain/repositories/experience.repository';
import { ExperienceOutput } from '../dto/experience.output';
import { toExperienceOutput } from '../mappers/experience.mapper';

export interface GetExperienceByIdInput {
  id: string;
  locale: Locale;
}

/** Devuelve una experiencia visible por id, resuelta al idioma pedido. */
@Injectable()
export class GetExperienceByIdUseCase {
  constructor(@Inject(EXPERIENCE_REPOSITORY) private readonly experiences: ExperienceRepository) {}

  async execute(
    input: GetExperienceByIdInput,
  ): Promise<Result<ExperienceOutput, ExperienceNotFoundError>> {
    const experience = await this.experiences.findVisibleById(input.id);
    if (!experience || !experience.visible) return fail(new ExperienceNotFoundError(input.id));
    return ok(toExperienceOutput(experience, input.locale));
  }
}

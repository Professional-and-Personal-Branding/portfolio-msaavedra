import { Inject, Injectable } from '@nestjs/common';
import { Locale } from '../../../../shared/domain/i18n';
import { ok, Ok } from '../../../../shared/domain/result';
import {
  EXPERIENCE_REPOSITORY,
  ExperienceRepository,
} from '../../domain/repositories/experience.repository';
import { sortExperiences } from '../../domain/services/sort-experiences';
import { ExperienceOutput } from '../dto/experience.output';
import { toExperienceOutput } from '../mappers/experience.mapper';

export interface ListExperiencesInput {
  locale: Locale;
}

/** Lista las experiencias visibles, en orden canónico, resueltas al idioma pedido. */
@Injectable()
export class ListExperiencesUseCase {
  constructor(@Inject(EXPERIENCE_REPOSITORY) private readonly experiences: ExperienceRepository) {}

  async execute(input: ListExperiencesInput): Promise<Ok<ExperienceOutput[]>> {
    const visible = await this.experiences.findAllVisible();
    const sorted = sortExperiences(visible.filter((e) => e.visible));
    return ok(sorted.map((e) => toExperienceOutput(e, input.locale)));
  }
}

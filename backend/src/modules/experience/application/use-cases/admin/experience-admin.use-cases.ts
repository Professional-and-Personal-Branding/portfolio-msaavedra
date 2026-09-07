import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '../../../../../shared/domain/errors';
import { fail, ok, Ok, Result } from '../../../../../shared/domain/result';
import { Experience, NewExperienceProps } from '../../../domain/entities/experience.entity';
import { ExperienceNotFoundError } from '../../../domain/errors/experience-not-found.error';
import {
  EXPERIENCE_REPOSITORY,
  ExperienceRepository,
} from '../../../domain/repositories/experience.repository';
import { sortExperiences } from '../../../domain/services/sort-experiences';
import { validateExperience } from '../../../domain/services/validate-experience';
import { AdminExperienceOutput } from '../../dto/experience.admin-output';
import { toAdminExperienceOutput } from '../../mappers/experience.admin-mapper';

/** Listado del backoffice: todas (incluidas ocultas), orden canónico, datos crudos. */
@Injectable()
export class ListAllExperiencesUseCase {
  constructor(@Inject(EXPERIENCE_REPOSITORY) private readonly experiences: ExperienceRepository) {}

  async execute(): Promise<Ok<AdminExperienceOutput[]>> {
    const all = await this.experiences.findAll();
    return ok(sortExperiences(all).map(toAdminExperienceOutput));
  }
}

@Injectable()
export class GetExperienceAdminUseCase {
  constructor(@Inject(EXPERIENCE_REPOSITORY) private readonly experiences: ExperienceRepository) {}

  async execute(input: {
    id: string;
  }): Promise<Result<AdminExperienceOutput, ExperienceNotFoundError>> {
    const found = await this.experiences.findById(input.id);
    if (!found) return fail(new ExperienceNotFoundError(input.id));
    return ok(toAdminExperienceOutput(found));
  }
}

@Injectable()
export class CreateExperienceUseCase {
  constructor(@Inject(EXPERIENCE_REPOSITORY) private readonly experiences: ExperienceRepository) {}

  async execute(
    props: NewExperienceProps,
  ): Promise<Result<AdminExperienceOutput, ValidationError>> {
    const valid = validateExperience(props);
    if (!valid.ok) return valid;
    const created = await this.experiences.create(props);
    return ok(toAdminExperienceOutput(created));
  }
}

export interface UpdateExperienceInput {
  id: string;
  changes: Partial<NewExperienceProps>;
}

@Injectable()
export class UpdateExperienceUseCase {
  constructor(@Inject(EXPERIENCE_REPOSITORY) private readonly experiences: ExperienceRepository) {}

  async execute(
    input: UpdateExperienceInput,
  ): Promise<Result<AdminExperienceOutput, ExperienceNotFoundError | ValidationError>> {
    const existing = await this.experiences.findById(input.id);
    if (!existing) return fail(new ExperienceNotFoundError(input.id));

    const updated: Experience = existing.with(input.changes);
    const valid = validateExperience(updated.toProps());
    if (!valid.ok) return valid;

    const saved = await this.experiences.update(updated);
    if (!saved) return fail(new ExperienceNotFoundError(input.id));
    return ok(toAdminExperienceOutput(saved));
  }
}

@Injectable()
export class DeleteExperienceUseCase {
  constructor(@Inject(EXPERIENCE_REPOSITORY) private readonly experiences: ExperienceRepository) {}

  async execute(input: { id: string }): Promise<Result<void, ExperienceNotFoundError>> {
    const deleted = await this.experiences.delete(input.id);
    if (!deleted) return fail(new ExperienceNotFoundError(input.id));
    return ok(undefined);
  }
}

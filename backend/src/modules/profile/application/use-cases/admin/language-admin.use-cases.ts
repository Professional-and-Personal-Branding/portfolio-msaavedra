import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '../../../../../shared/domain/errors';
import { fail, ok, Ok, Result } from '../../../../../shared/domain/result';
import { NewLanguageProps } from '../../../domain/entities/language.entity';
import { LanguageNotFoundError } from '../../../domain/errors/language-not-found.error';
import { ProfileNotFoundError } from '../../../domain/errors/profile-not-found.error';
import {
  LANGUAGE_REPOSITORY,
  LanguageRepository,
  PROFILE_REPOSITORY,
  ProfileRepository,
} from '../../../domain/repositories/profile.repository';
import { validateLanguage } from '../../../domain/services/validate-profile';
import { AdminLanguageOutput } from '../../dto/profile.admin-output';
import { toAdminLanguageOutput } from '../../mappers/profile.admin-mapper';

@Injectable()
export class ListAllLanguagesUseCase {
  constructor(@Inject(LANGUAGE_REPOSITORY) private readonly languages: LanguageRepository) {}

  async execute(): Promise<Ok<AdminLanguageOutput[]>> {
    return ok((await this.languages.findAll()).map(toAdminLanguageOutput));
  }
}

@Injectable()
export class GetLanguageAdminUseCase {
  constructor(@Inject(LANGUAGE_REPOSITORY) private readonly languages: LanguageRepository) {}

  async execute(input: {
    id: string;
  }): Promise<Result<AdminLanguageOutput, LanguageNotFoundError>> {
    const found = await this.languages.findById(input.id);
    if (!found) return fail(new LanguageNotFoundError(input.id));
    return ok(toAdminLanguageOutput(found));
  }
}

/** Crea un idioma colgado del perfil base: sin perfil cargado no hay de quién colgarlo. */
@Injectable()
export class CreateLanguageUseCase {
  constructor(
    @Inject(LANGUAGE_REPOSITORY) private readonly languages: LanguageRepository,
    @Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository,
  ) {}

  async execute(
    props: NewLanguageProps,
  ): Promise<Result<AdminLanguageOutput, ValidationError | ProfileNotFoundError>> {
    const valid = validateLanguage(props);
    if (!valid.ok) return valid;

    const profile = await this.profiles.findOne();
    if (!profile) return fail(new ProfileNotFoundError());
    return ok(toAdminLanguageOutput(await this.languages.create(profile.id, props)));
  }
}

export interface UpdateLanguageInput {
  id: string;
  changes: Partial<NewLanguageProps>;
}

@Injectable()
export class UpdateLanguageUseCase {
  constructor(@Inject(LANGUAGE_REPOSITORY) private readonly languages: LanguageRepository) {}

  async execute(
    input: UpdateLanguageInput,
  ): Promise<Result<AdminLanguageOutput, LanguageNotFoundError | ValidationError>> {
    const existing = await this.languages.findById(input.id);
    if (!existing) return fail(new LanguageNotFoundError(input.id));

    const updated = existing.with(input.changes);
    const valid = validateLanguage(updated.toProps());
    if (!valid.ok) return valid;

    const saved = await this.languages.update(updated);
    if (!saved) return fail(new LanguageNotFoundError(input.id));
    return ok(toAdminLanguageOutput(saved));
  }
}

@Injectable()
export class DeleteLanguageUseCase {
  constructor(@Inject(LANGUAGE_REPOSITORY) private readonly languages: LanguageRepository) {}

  async execute(input: { id: string }): Promise<Result<void, LanguageNotFoundError>> {
    const deleted = await this.languages.delete(input.id);
    if (!deleted) return fail(new LanguageNotFoundError(input.id));
    return ok(undefined);
  }
}

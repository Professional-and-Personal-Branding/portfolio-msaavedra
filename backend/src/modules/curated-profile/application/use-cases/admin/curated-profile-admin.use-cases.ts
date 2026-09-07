import { Inject, Injectable } from '@nestjs/common';
import { ConflictError, ValidationError } from '../../../../../shared/domain/errors';
import { fail, ok, Ok, Result } from '../../../../../shared/domain/result';
import {
  THEME_REPOSITORY,
  ThemeRepository,
} from '../../../../theme/domain/repositories/theme.repository';
import {
  CuratedProfile,
  NewCuratedProfileProps,
} from '../../../domain/entities/curated-profile.entity';
import { CuratedProfileNotFoundError } from '../../../domain/errors/curated-profile-not-found.error';
import {
  CURATED_PROFILE_REPOSITORY,
  CuratedProfileRepository,
} from '../../../domain/repositories/curated-profile.repository';
import { validateCuratedProfile } from '../../../domain/services/validate-curated-profile';
import { AdminCuratedProfileOutput } from '../../dto/curated-profile.admin-output';
import { toAdminCuratedProfileOutput } from '../../mappers/curated-profile.admin-mapper';

export type CuratedProfileWriteError =
  CuratedProfileNotFoundError | ValidationError | ConflictError;

@Injectable()
export class ListAllCuratedProfilesUseCase {
  constructor(
    @Inject(CURATED_PROFILE_REPOSITORY) private readonly repo: CuratedProfileRepository,
  ) {}

  async execute(): Promise<Ok<AdminCuratedProfileOutput[]>> {
    return ok((await this.repo.findAll()).map(toAdminCuratedProfileOutput));
  }
}

@Injectable()
export class GetCuratedProfileAdminUseCase {
  constructor(
    @Inject(CURATED_PROFILE_REPOSITORY) private readonly repo: CuratedProfileRepository,
  ) {}

  async execute(input: {
    id: string;
  }): Promise<Result<AdminCuratedProfileOutput, CuratedProfileNotFoundError>> {
    const found = await this.repo.findById(input.id);
    if (!found) return fail(new CuratedProfileNotFoundError(input.id));
    return ok(toAdminCuratedProfileOutput(found));
  }
}

/** Reglas compartidas por create/update que dependen de otros agregados. */
async function checkReferences(
  props: NewCuratedProfileProps,
  repo: CuratedProfileRepository,
  themes: ThemeRepository,
  excludeId?: string,
): Promise<Result<void, ValidationError | ConflictError>> {
  if (await repo.existsBySlug(props.slug, excludeId)) {
    return fail(new ConflictError('Perfil curado', `el slug "${props.slug}" ya existe`));
  }
  if (props.themeId !== null && !(await themes.findById(props.themeId))) {
    return fail(new ValidationError(`themeId "${props.themeId}" no existe`, ['themeId']));
  }
  return ok(undefined);
}

@Injectable()
export class CreateCuratedProfileUseCase {
  constructor(
    @Inject(CURATED_PROFILE_REPOSITORY) private readonly repo: CuratedProfileRepository,
    @Inject(THEME_REPOSITORY) private readonly themes: ThemeRepository,
  ) {}

  async execute(
    props: NewCuratedProfileProps,
  ): Promise<Result<AdminCuratedProfileOutput, ValidationError | ConflictError>> {
    const valid = validateCuratedProfile(props);
    if (!valid.ok) return valid;
    const refs = await checkReferences(props, this.repo, this.themes);
    if (!refs.ok) return refs;
    return ok(toAdminCuratedProfileOutput(await this.repo.create(props)));
  }
}

export interface UpdateCuratedProfileInput {
  id: string;
  changes: Partial<NewCuratedProfileProps>;
}

@Injectable()
export class UpdateCuratedProfileUseCase {
  constructor(
    @Inject(CURATED_PROFILE_REPOSITORY) private readonly repo: CuratedProfileRepository,
    @Inject(THEME_REPOSITORY) private readonly themes: ThemeRepository,
  ) {}

  async execute(
    input: UpdateCuratedProfileInput,
  ): Promise<Result<AdminCuratedProfileOutput, CuratedProfileWriteError>> {
    const existing = await this.repo.findById(input.id);
    if (!existing) return fail(new CuratedProfileNotFoundError(input.id));

    const updated: CuratedProfile = existing.with(input.changes);
    const props = updated.toProps();
    const valid = validateCuratedProfile(props);
    if (!valid.ok) return valid;
    const refs = await checkReferences(props, this.repo, this.themes, existing.id);
    if (!refs.ok) return refs;

    const saved = await this.repo.update(updated);
    if (!saved) return fail(new CuratedProfileNotFoundError(input.id));
    return ok(toAdminCuratedProfileOutput(saved));
  }
}

@Injectable()
export class DeleteCuratedProfileUseCase {
  constructor(
    @Inject(CURATED_PROFILE_REPOSITORY) private readonly repo: CuratedProfileRepository,
  ) {}

  async execute(input: { id: string }): Promise<Result<void, CuratedProfileNotFoundError>> {
    const deleted = await this.repo.delete(input.id);
    if (!deleted) return fail(new CuratedProfileNotFoundError(input.id));
    return ok(undefined);
  }
}

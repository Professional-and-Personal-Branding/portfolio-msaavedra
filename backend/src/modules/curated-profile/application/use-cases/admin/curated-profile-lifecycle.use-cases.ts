import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, Clock } from '../../../../../shared/domain/clock';
import { ConflictError } from '../../../../../shared/domain/errors';
import { fail, ok, Result } from '../../../../../shared/domain/result';
import { NewCuratedProfileProps } from '../../../domain/entities/curated-profile.entity';
import { CuratedProfileNotFoundError } from '../../../domain/errors/curated-profile-not-found.error';
import {
  CURATED_PROFILE_REPOSITORY,
  CuratedProfileRepository,
} from '../../../domain/repositories/curated-profile.repository';
import { AccessToken } from '../../../domain/value-objects/access-token.vo';
import { AdminCuratedProfileOutput } from '../../dto/curated-profile.admin-output';
import { toAdminCuratedProfileOutput } from '../../mappers/curated-profile.admin-mapper';

/** Hasta `-50`: más allá es un error, no un bucle (decisión D3). */
export const MAX_DUPLICATE_SUFFIX = 50;

/**
 * Duplicar (spec `admin-curated-profile-crud`, decisión D3). Copia la
 * configuración y deja afuera lo que es propio del original: token, visitas y
 * archivado. La copia nace `PRIVATE` y no enumerada, para que un duplicado a
 * medio configurar, con los textos del perfil anterior, nunca quede accesible
 * por un slug adivinable. El slug es el del original con el primer sufijo libre.
 */
@Injectable()
export class DuplicateCuratedProfileUseCase {
  constructor(
    @Inject(CURATED_PROFILE_REPOSITORY) private readonly repo: CuratedProfileRepository,
  ) {}

  async execute(input: {
    id: string;
  }): Promise<Result<AdminCuratedProfileOutput, CuratedProfileNotFoundError | ConflictError>> {
    const original = await this.repo.findById(input.id);
    if (!original) return fail(new CuratedProfileNotFoundError(input.id));

    const slug = await this.freeSlug(original.slug);
    if (!slug) {
      return fail(
        new ConflictError(
          'Perfil curado',
          `no hay un slug libre entre "${original.slug}-2" y "${original.slug}-${MAX_DUPLICATE_SUFFIX}"`,
        ),
      );
    }

    const source = original.toProps();
    const copy: NewCuratedProfileProps = {
      slug,
      title: source.title,
      headline: source.headline,
      description: source.description,
      roleType: source.roleType,
      techFocus: source.techFocus,
      filterTags: [...source.filterTags],
      includeIds: [...source.includeIds],
      excludeIds: [...source.excludeIds],
      accentColor: source.accentColor,
      themeId: source.themeId,
      themeOverrides: source.themeOverrides,
      layout: source.layout,
      sectionsOrder: [...source.sectionsOrder],
      sectionsHidden: [...source.sectionsHidden],
      visibility: 'PRIVATE',
      listed: false,
      accessToken: AccessToken.none(),
    };
    return ok(toAdminCuratedProfileOutput(await this.repo.create(copy)));
  }

  private async freeSlug(base: string): Promise<string | null> {
    for (let suffix = 2; suffix <= MAX_DUPLICATE_SUFFIX; suffix += 1) {
      const candidate = `${base}-${suffix}`;
      if (!(await this.repo.existsBySlug(candidate))) return candidate;
    }
    return null;
  }
}

/**
 * Archivar (decisión D4): el perfil deja de resolver (404) y de enumerarse, y
 * conserva sus visitas. Idempotente: archivar dos veces conserva la primera fecha.
 * La fecha la pone el servidor, nunca el cliente.
 */
@Injectable()
export class ArchiveCuratedProfileUseCase {
  constructor(
    @Inject(CURATED_PROFILE_REPOSITORY) private readonly repo: CuratedProfileRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(input: {
    id: string;
  }): Promise<Result<AdminCuratedProfileOutput, CuratedProfileNotFoundError>> {
    const found = await this.repo.findById(input.id);
    if (!found) return fail(new CuratedProfileNotFoundError(input.id));
    if (found.isArchived) return ok(toAdminCuratedProfileOutput(found));

    const saved = await this.repo.update(found.with({ archivedAt: this.clock.now() }));
    if (!saved) return fail(new CuratedProfileNotFoundError(input.id));
    return ok(toAdminCuratedProfileOutput(saved));
  }
}

/** Desarchivar: el perfil vuelve a resolver según su visibilidad. Idempotente. */
@Injectable()
export class UnarchiveCuratedProfileUseCase {
  constructor(
    @Inject(CURATED_PROFILE_REPOSITORY) private readonly repo: CuratedProfileRepository,
  ) {}

  async execute(input: {
    id: string;
  }): Promise<Result<AdminCuratedProfileOutput, CuratedProfileNotFoundError>> {
    const found = await this.repo.findById(input.id);
    if (!found) return fail(new CuratedProfileNotFoundError(input.id));
    if (!found.isArchived) return ok(toAdminCuratedProfileOutput(found));

    const saved = await this.repo.update(found.with({ archivedAt: null }));
    if (!saved) return fail(new CuratedProfileNotFoundError(input.id));
    return ok(toAdminCuratedProfileOutput(saved));
  }
}

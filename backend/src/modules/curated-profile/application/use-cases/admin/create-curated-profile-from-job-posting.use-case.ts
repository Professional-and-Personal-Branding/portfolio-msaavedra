import { Inject, Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError, ValidationError } from '../../../../../shared/domain/errors';
import { fail, Result } from '../../../../../shared/domain/result';
import { slugifyDraft } from '../../../../../shared/domain/slugify-draft';
import {
  JOB_POSTING_READER,
  JobPostingReader,
} from '../../../../job-posting/application/ports/job-posting.reader';
import { NewCuratedProfileProps } from '../../../domain/entities/curated-profile.entity';
import {
  CURATED_PROFILE_REPOSITORY,
  CuratedProfileRepository,
} from '../../../domain/repositories/curated-profile.repository';
import {
  TAG_VOCABULARY_READER,
  TagVocabularyReader,
} from '../../../domain/repositories/tag-vocabulary.reader';
import { AccessToken } from '../../../domain/value-objects/access-token.vo';
import { AdminCuratedProfileOutput } from '../../dto/curated-profile.admin-output';
import { MAX_DUPLICATE_SUFFIX } from './curated-profile-lifecycle.use-cases';
import { CreateCuratedProfileUseCase } from './curated-profile-admin.use-cases';

export interface CreateFromJobPostingInput {
  jobPostingId: string;
  filterTags: readonly string[];
  title?: string;
  slug?: string;
}

/**
 * Borrador de un perfil curado desde una vacante importada (change `add-job-posting-intake`, D17).
 * `job-posting` solo **sugiere**; este caso de uso, de `curated-profile`, es el que crea. Los
 * `filterTags` deben existir en el vocabulario de los datos del owner (el mismo criterio que la
 * regla `curated.unmatched-filter-tag`), así el borrador nunca nace con un filtro vacío de
 * resultados. Nace `PRIVATE`, no enumerado y sin token: nadie lo ve hasta que el owner lo publique.
 * La vacante no se modifica y el perfil no guarda ningún vínculo con ella (D21).
 */
@Injectable()
export class CreateCuratedProfileFromJobPostingUseCase {
  constructor(
    @Inject(JOB_POSTING_READER) private readonly postings: JobPostingReader,
    @Inject(TAG_VOCABULARY_READER) private readonly vocabulary: TagVocabularyReader,
    @Inject(CURATED_PROFILE_REPOSITORY) private readonly repo: CuratedProfileRepository,
    private readonly createProfile: CreateCuratedProfileUseCase,
  ) {}

  async execute(
    input: CreateFromJobPostingInput,
  ): Promise<Result<AdminCuratedProfileOutput, NotFoundError | ValidationError | ConflictError>> {
    const posting = await this.postings.findDraftSource(input.jobPostingId);
    if (!posting) return fail(new NotFoundError('Vacante', input.jobPostingId));

    const tags = input.filterTags;
    if (tags.length === 0) {
      return fail(new ValidationError('Elegí al menos un tag', ['filterTags']));
    }
    if (new Set(tags).size !== tags.length) {
      return fail(new ValidationError('filterTags no admite tags repetidos', ['filterTags']));
    }
    const known = new Set((await this.vocabulary.read()).tags);
    const unknown = tags.filter((tag) => !known.has(tag));
    if (unknown.length > 0) {
      return fail(
        new ValidationError(`Estos tags no existen en tus datos: ${unknown.join(', ')}`, [
          'filterTags',
        ]),
      );
    }

    const slug = input.slug ?? (await this.freeSlug(slugifyDraft(posting.company, posting.title)));
    if (slug === null) {
      return fail(
        new ConflictError('Perfil curado', 'no hay un slug libre para este borrador; indicá uno'),
      );
    }

    const title = input.title?.trim() || posting.title;
    const props: NewCuratedProfileProps = {
      slug,
      title: { es: title, en: title },
      headline: {},
      description: null,
      roleType: null,
      techFocus: null,
      filterTags: [...tags],
      includeIds: [],
      excludeIds: [],
      themeId: null,
      themeOverrides: null,
      layout: 'classic',
      sectionsOrder: [],
      sectionsHidden: [],
      visibility: 'PRIVATE',
      listed: false,
      accessToken: AccessToken.none(),
    };
    // El mismo camino que crear a mano: validación de dominio y slug único (alias incluidos).
    return this.createProfile.execute(props);
  }

  /** La base y, si está ocupada, `-2` … `-50` (el mismo límite que duplicar). */
  private async freeSlug(base: string): Promise<string | null> {
    if (!(await this.repo.existsBySlug(base))) return base;
    for (let suffix = 2; suffix <= MAX_DUPLICATE_SUFFIX; suffix += 1) {
      const candidate = `${base}-${suffix}`;
      if (!(await this.repo.existsBySlug(candidate))) return candidate;
    }
    return null;
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { Locale } from '../../../../shared/domain/i18n';
import { ok, Ok } from '../../../../shared/domain/result';
import {
  CURATED_PROFILE_REPOSITORY,
  CuratedProfileRepository,
} from '../../domain/repositories/curated-profile.repository';
import { isPubliclyListed } from '../../domain/services/publicly-listed';
import { CuratedProfileSummaryOutput } from '../dto/curated-profile.output';
import { toCuratedProfileSummary } from '../mappers/curated-profile.mapper';

export interface ListCuratedProfilesInput {
  locale: Locale;
}

/**
 * Listado para el menú de navegación, resuelto al locale: solo lo que
 * `isPubliclyListed` enumera (PUBLIC, `listed` y no archivado), el mismo
 * criterio que el sitemap.
 */
@Injectable()
export class ListCuratedProfilesUseCase {
  constructor(
    @Inject(CURATED_PROFILE_REPOSITORY) private readonly curatedProfiles: CuratedProfileRepository,
  ) {}

  async execute(input: ListCuratedProfilesInput): Promise<Ok<CuratedProfileSummaryOutput[]>> {
    const profiles = await this.curatedProfiles.findAllPublic();
    return ok(
      profiles.filter(isPubliclyListed).map((p) => toCuratedProfileSummary(p, input.locale)),
    );
  }
}

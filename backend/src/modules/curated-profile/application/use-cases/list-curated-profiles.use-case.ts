import { Inject, Injectable } from '@nestjs/common';
import { Locale } from '../../../../shared/domain/i18n';
import { ok, Ok } from '../../../../shared/domain/result';
import {
  CURATED_PROFILE_REPOSITORY,
  CuratedProfileRepository,
} from '../../domain/repositories/curated-profile.repository';
import { CuratedProfileSummaryOutput } from '../dto/curated-profile.output';
import { toCuratedProfileSummary } from '../mappers/curated-profile.mapper';

export interface ListCuratedProfilesInput {
  locale: Locale;
}

/** Listado para el menú de navegación: solo perfiles PUBLIC, resueltos al locale. */
@Injectable()
export class ListCuratedProfilesUseCase {
  constructor(
    @Inject(CURATED_PROFILE_REPOSITORY) private readonly curatedProfiles: CuratedProfileRepository,
  ) {}

  async execute(input: ListCuratedProfilesInput): Promise<Ok<CuratedProfileSummaryOutput[]>> {
    const profiles = await this.curatedProfiles.findAllPublic();
    return ok(
      profiles.filter((p) => p.isPublic).map((p) => toCuratedProfileSummary(p, input.locale)),
    );
  }
}

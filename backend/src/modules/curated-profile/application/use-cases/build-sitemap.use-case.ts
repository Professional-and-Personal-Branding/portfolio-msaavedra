import { Inject, Injectable } from '@nestjs/common';
import { ok, Ok } from '../../../../shared/domain/result';
import {
  CURATED_PROFILE_REPOSITORY,
  CuratedProfileRepository,
} from '../../domain/repositories/curated-profile.repository';
import { buildSitemapXml, toSitemapEntries } from '../services/sitemap.builder';

/** Sitemap con los perfiles públicos (spec `public-seo`). No puede fallar. */
@Injectable()
export class BuildSitemapUseCase {
  constructor(
    @Inject(CURATED_PROFILE_REPOSITORY) private readonly curatedProfiles: CuratedProfileRepository,
  ) {}

  async execute(input: { baseUrl: string }): Promise<Ok<string>> {
    const profiles = await this.curatedProfiles.findAllPublic();
    const entries = toSitemapEntries(
      profiles.map((profile) => ({
        slug: profile.slug,
        visibility: profile.visibility,
        updatedAt: profile.updatedAt,
      })),
    );
    return ok(buildSitemapXml(input.baseUrl, entries));
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { Locale } from '../../../../shared/domain/i18n';
import { ok, Ok } from '../../../../shared/domain/result';
import {
  FEATURED_REPOSITORY_REPOSITORY,
  FeaturedRepositoryRepository,
} from '../../domain/repositories/featured-repository.repository';
import { FeaturedRepositoryOutput } from '../dto/featured-repository.output';
import { toFeaturedRepositoryOutput } from '../mappers/featured-repository.mapper';

@Injectable()
export class ListFeaturedRepositoriesUseCase {
  constructor(
    @Inject(FEATURED_REPOSITORY_REPOSITORY) private readonly repo: FeaturedRepositoryRepository,
  ) {}

  async execute(input: { locale: Locale }): Promise<Ok<FeaturedRepositoryOutput[]>> {
    const items = await this.repo.findAllVisible();
    return ok(
      items.filter((r) => r.visible).map((r) => toFeaturedRepositoryOutput(r, input.locale)),
    );
  }
}

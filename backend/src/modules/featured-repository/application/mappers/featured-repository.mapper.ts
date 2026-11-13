import { Locale, resolveLocale } from '../../../../shared/domain/i18n';
import { FeaturedRepository } from '../../domain/entities/featured-repository.entity';
import { FeaturedRepositoryOutput } from '../dto/featured-repository.output';

export function toFeaturedRepositoryOutput(
  r: FeaturedRepository,
  locale: Locale,
): FeaturedRepositoryOutput {
  return {
    id: r.id,
    name: r.name,
    url: r.url,
    language: r.language,
    description: resolveLocale(r.description, locale),
    technologies: [...r.technologies],
    tags: [...r.tags],
    order: r.order,
  };
}

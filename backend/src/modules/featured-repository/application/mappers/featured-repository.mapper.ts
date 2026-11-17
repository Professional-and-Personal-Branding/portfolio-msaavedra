import { Locale, resolveLocale } from '../../../../shared/domain/i18n';
import { FeaturedRepository } from '../../domain/entities/featured-repository.entity';
import {
  effectiveLanguage,
  presentRepositoryEvidence,
} from '../../domain/services/present-repository-evidence';
import { FeaturedRepositoryOutput } from '../dto/featured-repository.output';

/**
 * Salida pública de un repositorio. La vista curada, el preview, el listado y el JSON Resume la
 * comparten: `language` es el lenguaje efectivo (D9) y `evidence` es `null` salvo que haya
 * evidencia `OK` cuyo `repoKey` coincida con la URL actual (D10).
 */
export function toFeaturedRepositoryOutput(
  r: FeaturedRepository,
  locale: Locale,
): FeaturedRepositoryOutput {
  const evidence = presentRepositoryEvidence(r, r.evidence);
  return {
    id: r.id,
    name: r.name,
    url: r.url,
    language: effectiveLanguage(r, r.evidence),
    description: resolveLocale(r.description, locale),
    technologies: [...r.technologies],
    tags: [...r.tags],
    order: r.order,
    evidence: evidence && {
      stars: evidence.stars,
      languages: evidence.languages.map((language) => ({ ...language })),
      topics: [...evidence.topics],
      pushedAt: evidence.pushedAt,
      archived: evidence.archived,
      verifiedAt: evidence.verifiedAt,
    },
  };
}

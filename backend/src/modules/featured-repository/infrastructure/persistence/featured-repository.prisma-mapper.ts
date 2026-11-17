import type {
  FeaturedRepository as FeaturedRepositoryRecord,
  Prisma,
  RepositoryEvidence as RepositoryEvidenceRecord,
} from '@prisma/client';
import { toLocalizedText } from '../../../../shared/infrastructure/persistence/json.guards';
import {
  FeaturedRepository,
  NewFeaturedRepositoryProps,
} from '../../domain/entities/featured-repository.entity';
import { RepositoryEvidence } from '../../domain/value-objects/repository-evidence';

export type { FeaturedRepositoryRecord };

/** Fila de `FeaturedRepository` con su evidencia (`include: { evidence: true }`), si se pidió. */
export type FeaturedRepositoryWithEvidence = FeaturedRepositoryRecord & {
  evidence?: RepositoryEvidenceRecord | null;
};

/** `{ lenguaje: bytes }` desde el Json de la base; lo que no sea un conteo entero ≥ 0 se descarta. */
function toLanguages(value: unknown): Record<string, number> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, number] =>
      typeof entry[1] === 'number' && Number.isInteger(entry[1]) && entry[1] >= 0,
  );
  return Object.fromEntries(entries);
}

export function toRepositoryEvidence(r: RepositoryEvidenceRecord): RepositoryEvidence {
  return {
    repoKey: r.repoKey,
    status: r.status,
    stars: r.stars,
    primaryLanguage: r.primaryLanguage,
    languages: toLanguages(r.languages),
    topics: r.topics,
    pushedAt: r.pushedAt,
    archived: r.archived,
    isFork: r.isFork,
    movedTo: r.movedTo,
    githubDescription: r.githubDescription,
    verifiedAt: r.verifiedAt,
    changedAt: r.changedAt,
  };
}

/** La columna `stars` se ignora (inerte, P3): las stars viven en la evidencia verificada. */
export function toFeaturedRepositoryEntity(r: FeaturedRepositoryWithEvidence): FeaturedRepository {
  return FeaturedRepository.create({
    id: r.id,
    name: r.name,
    url: r.url,
    language: r.language,
    description: toLocalizedText(r.description, 'FeaturedRepository.description'),
    technologies: r.technologies,
    tags: r.tags,
    order: r.order,
    visible: r.visible,
    evidence: r.evidence ? toRepositoryEvidence(r.evidence) : null,
  });
}

/** Props de dominio → datos de escritura Prisma (Json para el bilingüe; sin `stars` ni evidencia). */
export function toFeaturedRepositoryData(
  props: NewFeaturedRepositoryProps,
): Prisma.FeaturedRepositoryUncheckedCreateInput {
  return {
    name: props.name,
    url: props.url,
    language: props.language,
    description: props.description,
    technologies: [...props.technologies],
    tags: [...props.tags],
    order: props.order,
    visible: props.visible,
  };
}

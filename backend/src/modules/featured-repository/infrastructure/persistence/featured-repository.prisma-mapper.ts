import type { FeaturedRepository as FeaturedRepositoryRecord, Prisma } from '@prisma/client';
import { toLocalizedText } from '../../../../shared/infrastructure/persistence/json.guards';
import {
  FeaturedRepository,
  NewFeaturedRepositoryProps,
} from '../../domain/entities/featured-repository.entity';

export type { FeaturedRepositoryRecord };

/** La columna `stars` se ignora: la llenará la sincronización con GitHub. */
export function toFeaturedRepositoryEntity(r: FeaturedRepositoryRecord): FeaturedRepository {
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
  });
}

/** Props de dominio → datos de escritura Prisma (Json para el bilingüe; sin `stars`). */
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

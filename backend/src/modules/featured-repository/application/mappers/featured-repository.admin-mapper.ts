import { FeaturedRepository } from '../../domain/entities/featured-repository.entity';
import { AdminFeaturedRepositoryOutput } from '../dto/featured-repository.admin-output';

export function toAdminFeaturedRepositoryOutput(
  r: FeaturedRepository,
): AdminFeaturedRepositoryOutput {
  return {
    id: r.id,
    name: r.name,
    url: r.url,
    language: r.language,
    description: r.description,
    technologies: [...r.technologies],
    tags: [...r.tags],
    order: r.order,
    visible: r.visible,
  };
}

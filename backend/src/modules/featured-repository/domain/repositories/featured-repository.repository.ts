import {
  FeaturedRepository,
  NewFeaturedRepositoryProps,
} from '../entities/featured-repository.entity';

export const FEATURED_REPOSITORY_REPOSITORY = Symbol('FeaturedRepositoryRepository');

/**
 * Puerto de persistencia de repositorios destacados. Lectura pública (solo visibles, por
 * `order` asc) + escritura del backoffice.
 */
export interface FeaturedRepositoryRepository {
  findAllVisible(): Promise<FeaturedRepository[]>;

  /** Todos, incluidos los ocultos (backoffice), por `order` asc. */
  findAll(): Promise<FeaturedRepository[]>;
  findById(id: string): Promise<FeaturedRepository | null>;
  create(props: NewFeaturedRepositoryProps): Promise<FeaturedRepository>;
  /** Persiste el estado completo de la entidad; null si ya no existe. */
  update(repository: FeaturedRepository): Promise<FeaturedRepository | null>;
  /** true si existía y fue borrado. */
  delete(id: string): Promise<boolean>;
}

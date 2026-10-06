import { NewProjectProps, Project } from '../entities/project.entity';

export const PROJECT_REPOSITORY = Symbol('ProjectRepository');

/**
 * Puerto de persistencia de proyectos. Lectura pública (solo visibles, por
 * `order` asc) + escritura del backoffice (add-profile-content-admin).
 */
export interface ProjectRepository {
  findAllVisible(): Promise<Project[]>;

  /** Todos, incluidos los ocultos (backoffice), por `order` asc. */
  findAll(): Promise<Project[]>;
  findById(id: string): Promise<Project | null>;
  create(props: NewProjectProps): Promise<Project>;
  /** Persiste el estado completo de la entidad; null si ya no existe. */
  update(project: Project): Promise<Project | null>;
  /** true si existía y fue borrado. */
  delete(id: string): Promise<boolean>;
}

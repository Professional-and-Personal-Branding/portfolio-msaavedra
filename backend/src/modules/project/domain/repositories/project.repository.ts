import { Project } from '../entities/project.entity';

export const PROJECT_REPOSITORY = Symbol('ProjectRepository');

/** Lectura pública: solo visibles, ordenados por `order` asc. */
export interface ProjectRepository {
  findAllVisible(): Promise<Project[]>;
}

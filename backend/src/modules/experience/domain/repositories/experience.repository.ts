import { Experience } from '../entities/experience.entity';

/** Token de inyección del puerto (un Symbol no depende de NestJS). */
export const EXPERIENCE_REPOSITORY = Symbol('ExperienceRepository');

/** Puerto de persistencia de experiencias (lectura pública). */
export interface ExperienceRepository {
  /** Experiencias marcadas visibles. El orden final lo garantiza el dominio (`sortExperiences`). */
  findAllVisible(): Promise<Experience[]>;
  /** Experiencia visible por id, o null si no existe o está oculta. */
  findVisibleById(id: string): Promise<Experience | null>;
}

import { Experience, NewExperienceProps } from '../entities/experience.entity';

/** Token de inyección del puerto (un Symbol no depende de NestJS). */
export const EXPERIENCE_REPOSITORY = Symbol('ExperienceRepository');

/**
 * Puerto de persistencia de experiencias. Lectura pública (Fase 1) + escritura
 * del backoffice (Fase 3). Los consumidores públicos solo usan los métodos `*Visible*`.
 */
export interface ExperienceRepository {
  /** Experiencias marcadas visibles. El orden final lo garantiza el dominio (`sortExperiences`). */
  findAllVisible(): Promise<Experience[]>;
  /** Experiencia visible por id, o null si no existe o está oculta. */
  findVisibleById(id: string): Promise<Experience | null>;

  /** Todas, incluidas las ocultas (backoffice). */
  findAll(): Promise<Experience[]>;
  findById(id: string): Promise<Experience | null>;
  create(props: NewExperienceProps): Promise<Experience>;
  /** Persiste el estado completo de la entidad; null si ya no existe. */
  update(experience: Experience): Promise<Experience | null>;
  /** true si existía y fue borrada. */
  delete(id: string): Promise<boolean>;
}

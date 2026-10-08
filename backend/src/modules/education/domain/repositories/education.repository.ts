import { Certification, NewCertificationProps } from '../entities/certification.entity';
import { Education, NewEducationProps } from '../entities/education.entity';

export const EDUCATION_REPOSITORY = Symbol('EducationRepository');
export const CERTIFICATION_REPOSITORY = Symbol('CertificationRepository');

/**
 * Puerto de persistencia de formación. Lectura pública (solo visibles, por
 * `order` asc) + escritura del backoffice (add-profile-content-admin).
 */
export interface EducationRepository {
  findAllVisible(): Promise<Education[]>;

  /** Todas, incluidas las ocultas (backoffice), por `order` asc. */
  findAll(): Promise<Education[]>;
  findById(id: string): Promise<Education | null>;
  create(props: NewEducationProps): Promise<Education>;
  /** Persiste el estado completo de la entidad; null si ya no existe. */
  update(education: Education): Promise<Education | null>;
  /** true si existía y fue borrada. */
  delete(id: string): Promise<boolean>;
}

/** Puerto de persistencia de certificaciones: mismo contrato que `EducationRepository`. */
export interface CertificationRepository {
  findAllVisible(): Promise<Certification[]>;

  /** Todas, incluidas las ocultas (backoffice), por `order` asc. */
  findAll(): Promise<Certification[]>;
  findById(id: string): Promise<Certification | null>;
  create(props: NewCertificationProps): Promise<Certification>;
  /** Persiste el estado completo de la entidad; null si ya no existe. */
  update(certification: Certification): Promise<Certification | null>;
  /** true si existía y fue borrada. */
  delete(id: string): Promise<boolean>;
}

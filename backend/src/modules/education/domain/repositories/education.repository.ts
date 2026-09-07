import { Certification } from '../entities/certification.entity';
import { Education } from '../entities/education.entity';

export const EDUCATION_REPOSITORY = Symbol('EducationRepository');
export const CERTIFICATION_REPOSITORY = Symbol('CertificationRepository');

/** Lectura pública: solo visibles, ordenados por `order` asc. */
export interface EducationRepository {
  findAllVisible(): Promise<Education[]>;
}

export interface CertificationRepository {
  findAllVisible(): Promise<Certification[]>;
}

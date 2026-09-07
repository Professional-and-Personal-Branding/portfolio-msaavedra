import type {
  Certification as CertificationRecord,
  Education as EducationRecord,
} from '@prisma/client';
import { toLocalizedText } from '../../../../shared/infrastructure/persistence/json.guards';
import { Certification } from '../../domain/entities/certification.entity';
import { Education } from '../../domain/entities/education.entity';

export type { CertificationRecord, EducationRecord };

export function toEducationEntity(r: EducationRecord): Education {
  return Education.create({
    id: r.id,
    degree: toLocalizedText(r.degree, 'Education.degree'),
    institution: r.institution,
    startDate: r.startDate,
    endDate: r.endDate,
    inProgress: r.inProgress,
    order: r.order,
    visible: r.visible,
  });
}

export function toCertificationEntity(r: CertificationRecord): Certification {
  return Certification.create({
    id: r.id,
    name: toLocalizedText(r.name, 'Certification.name'),
    issuer: r.issuer,
    year: r.year,
    order: r.order,
    visible: r.visible,
  });
}

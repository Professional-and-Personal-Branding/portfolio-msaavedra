import type {
  Certification as CertificationRecord,
  Education as EducationRecord,
  Prisma,
} from '@prisma/client';
import { toLocalizedText } from '../../../../shared/infrastructure/persistence/json.guards';
import { Certification, NewCertificationProps } from '../../domain/entities/certification.entity';
import { Education, NewEducationProps } from '../../domain/entities/education.entity';

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

/** Props de dominio → datos de escritura Prisma (Json para `degree`). */
export function toEducationData(props: NewEducationProps): Prisma.EducationUncheckedCreateInput {
  return {
    degree: props.degree,
    institution: props.institution,
    startDate: props.startDate,
    endDate: props.endDate,
    inProgress: props.inProgress,
    order: props.order,
    visible: props.visible,
  };
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

/** Props de dominio → datos de escritura Prisma (Json para `name`). */
export function toCertificationData(
  props: NewCertificationProps,
): Prisma.CertificationUncheckedCreateInput {
  return {
    name: props.name,
    issuer: props.issuer,
    year: props.year,
    order: props.order,
    visible: props.visible,
  };
}

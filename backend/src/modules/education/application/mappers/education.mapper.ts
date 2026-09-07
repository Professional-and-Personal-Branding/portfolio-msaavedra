import { Locale, resolveLocale } from '../../../../shared/domain/i18n';
import { Certification } from '../../domain/entities/certification.entity';
import { Education } from '../../domain/entities/education.entity';
import { CertificationOutput, EducationOutput } from '../dto/education.output';

export function toEducationOutput(e: Education, locale: Locale): EducationOutput {
  return {
    id: e.id,
    degree: resolveLocale(e.degree, locale),
    institution: e.institution,
    startDate: e.startDate,
    endDate: e.endDate,
    inProgress: e.inProgress,
    order: e.order,
  };
}

export function toCertificationOutput(c: Certification, locale: Locale): CertificationOutput {
  return {
    id: c.id,
    name: resolveLocale(c.name, locale),
    issuer: c.issuer,
    year: c.year,
    order: c.order,
  };
}

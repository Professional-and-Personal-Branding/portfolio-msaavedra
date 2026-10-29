import { Certification } from '../../domain/entities/certification.entity';
import { Education } from '../../domain/entities/education.entity';
import { AdminCertificationOutput, AdminEducationOutput } from '../dto/education.admin-output';

export function toAdminEducationOutput(e: Education): AdminEducationOutput {
  return {
    id: e.id,
    degree: e.degree,
    institution: e.institution,
    startDate: e.startDate,
    endDate: e.endDate,
    inProgress: e.inProgress,
    order: e.order,
    visible: e.visible,
  };
}

export function toAdminCertificationOutput(c: Certification): AdminCertificationOutput {
  return {
    id: c.id,
    name: c.name,
    issuer: c.issuer,
    year: c.year,
    verificationUrl: c.verificationUrl,
    credentialId: c.credentialId,
    expiresAt: c.expiresAt,
    order: c.order,
    visible: c.visible,
  };
}

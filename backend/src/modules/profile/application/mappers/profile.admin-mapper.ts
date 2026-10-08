import { Language } from '../../domain/entities/language.entity';
import { Profile } from '../../domain/entities/profile.entity';
import { AdminLanguageOutput, AdminProfileOutput } from '../dto/profile.admin-output';

export function toAdminProfileOutput(p: Profile): AdminProfileOutput {
  return {
    id: p.id,
    fullName: p.fullName,
    headline: p.headline,
    summary: p.summary,
    location: p.location,
    timezone: p.timezone,
    email: p.email,
    phone: p.phone,
    yearsOfExperience: p.yearsOfExperience,
    availability: {
      modality: p.availability.modality,
      contractType: p.availability.contractType,
      startDate: p.availability.startDate,
    },
  };
}

export function toAdminLanguageOutput(l: Language): AdminLanguageOutput {
  return {
    id: l.id,
    name: l.name,
    nameI18n: l.nameI18n,
    level: l.level,
    detail: l.detail,
  };
}

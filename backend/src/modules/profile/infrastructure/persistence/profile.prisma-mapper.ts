import type { Prisma } from '@prisma/client';
import { toLocalizedText } from '../../../../shared/infrastructure/persistence/json.guards';
import { Language } from '../../domain/entities/language.entity';
import { Profile } from '../../domain/entities/profile.entity';
import { Availability } from '../../domain/value-objects/availability.vo';

export type ProfileRecord = Prisma.ProfileGetPayload<{ include: { languages: true } }>;

/** Traduce el registro Prisma (persistencia) al agregado de dominio. */
export function toProfileEntity(record: ProfileRecord): Profile {
  return Profile.create({
    id: record.id,
    fullName: record.fullName,
    headline: toLocalizedText(record.headline, 'Profile.headline'),
    location: record.location,
    timezone: record.timezone,
    email: record.email,
    phone: record.phone,
    summary: toLocalizedText(record.summary, 'Profile.summary'),
    yearsOfExperience: record.yearsOfExperience,
    availability: Availability.create({
      modality: toLocalizedText(record.availModality, 'Profile.availModality'),
      contractType: toLocalizedText(record.availContractType, 'Profile.availContractType'),
      startDate: toLocalizedText(record.availStartDate, 'Profile.availStartDate'),
    }),
    languages: record.languages.map((l) =>
      Language.create({
        id: l.id,
        name: l.name,
        nameI18n: toLocalizedText(l.nameI18n, 'Language.nameI18n'),
        level: l.level,
        detail: toLocalizedText(l.detail, 'Language.detail'),
      }),
    ),
  });
}

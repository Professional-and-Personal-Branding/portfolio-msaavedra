import { Prisma } from '@prisma/client';
import type { Language as LanguageRecord } from '@prisma/client';
import { LocalizedText } from '../../../../shared/domain/i18n';
import { toLocalizedText } from '../../../../shared/infrastructure/persistence/json.guards';
import { Language, NewLanguageProps } from '../../domain/entities/language.entity';
import { Profile, ProfileContent } from '../../domain/entities/profile.entity';
import { Availability } from '../../domain/value-objects/availability.vo';

export type ProfileRecord = Prisma.ProfileGetPayload<{ include: { languages: true } }>;
export type { LanguageRecord };

/** Json opcional: una columna vacía sigue siendo `null` en el dominio, para que guardar no la convierta en `{}`. */
function optionalText(
  value: Prisma.JsonValue | null,
  field: string,
): LocalizedText | string | null {
  return value === null ? null : toLocalizedText(value, field);
}

export function toLanguageEntity(l: LanguageRecord): Language {
  return Language.create({
    id: l.id,
    name: l.name,
    nameI18n: optionalText(l.nameI18n, 'Language.nameI18n'),
    level: l.level,
    detail: optionalText(l.detail, 'Language.detail'),
  });
}

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
      modality: optionalText(record.availModality, 'Profile.availModality'),
      contractType: optionalText(record.availContractType, 'Profile.availContractType'),
      startDate: optionalText(record.availStartDate, 'Profile.availStartDate'),
    }),
    languages: record.languages.map(toLanguageEntity),
  });
}

/** Json opcional: `null` se persiste como DbNull (columna vacía, no el literal JSON `null`). */
function optionalJson(
  value: LocalizedText | string | null,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === null ? Prisma.DbNull : value;
}

/** Contenido de dominio → datos de escritura del perfil (sin idiomas). */
export function toProfileData(content: ProfileContent): Prisma.ProfileUpdateInput {
  return {
    fullName: content.fullName,
    headline: content.headline,
    location: content.location,
    timezone: content.timezone,
    email: content.email,
    phone: content.phone,
    summary: content.summary,
    yearsOfExperience: content.yearsOfExperience,
    availModality: optionalJson(content.availability.modality),
    availContractType: optionalJson(content.availability.contractType),
    availStartDate: optionalJson(content.availability.startDate),
  };
}

export function toLanguageData(
  props: NewLanguageProps,
): Omit<Prisma.LanguageUncheckedCreateInput, 'profileId'> {
  return {
    name: props.name,
    nameI18n: optionalJson(props.nameI18n),
    level: props.level,
    detail: optionalJson(props.detail),
  };
}

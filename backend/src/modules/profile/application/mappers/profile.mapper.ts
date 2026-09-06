import { Locale, resolveLocale } from '../../../../shared/domain/i18n';
import { Language } from '../../domain/entities/language.entity';
import { Profile } from '../../domain/entities/profile.entity';
import { LanguageOutput, ProfileOutput } from '../dto/profile.output';

function toLanguageOutput(language: Language, locale: Locale): LanguageOutput {
  const localizedName = resolveLocale(language.nameI18n, locale);
  return {
    name: localizedName || language.name,
    level: language.level,
    detail: resolveLocale(language.detail, locale),
  };
}

/** Proyecta el agregado bilingüe al idioma pedido. Único lugar donde el perfil "elige idioma". */
export function toProfileOutput(profile: Profile, locale: Locale): ProfileOutput {
  return {
    id: profile.id,
    fullName: profile.fullName,
    headline: resolveLocale(profile.headline, locale),
    location: profile.location,
    timezone: profile.timezone,
    email: profile.email,
    phone: profile.phone,
    summary: resolveLocale(profile.summary, locale),
    yearsOfExperience: profile.yearsOfExperience,
    availability: {
      modality: resolveLocale(profile.availability.modality, locale),
      contractType: resolveLocale(profile.availability.contractType, locale),
      startDate: resolveLocale(profile.availability.startDate, locale),
    },
    languages: profile.languages.map((l) => toLanguageOutput(l, locale)),
  };
}

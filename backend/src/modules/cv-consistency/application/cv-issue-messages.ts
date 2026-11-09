import { Locale, LocalizedField, resolveLocale } from '../../../shared/domain/i18n';
import { CvIssue, CvIssueCode, CvIssueParams } from '../domain/cv-issue';
import { CvSnapshot } from '../domain/cv-snapshot';

/**
 * Plantillas de mensaje por código y por idioma (D8). El dominio no tiene textos: acá se
 * interpola `{param}` con los `params` de la regla más tres variables derivadas: `{field}` (el
 * campo del hallazgo), `{localeName}` (el idioma de `params.locale`, escrito en el idioma del
 * mensaje) y `{httpsOnly}` (la aclaración que solo lleva la URL de una certificación).
 */
export const CV_ISSUE_TEMPLATES: Readonly<Record<CvIssueCode, Readonly<Record<Locale, string>>>> = {
  'profile.years-mismatch': {
    es: 'Declarás {declared} años de experiencia, pero las experiencias cargadas suman {years} años y {remainderMonths} meses.',
    en: 'You declare {declared} years of experience, but the loaded experiences add up to {years} years and {remainderMonths} months.',
  },
  'date.invalid-format': {
    es: '{field} no tiene un formato válido ({expected}): «{value}».',
    en: '{field} does not have a valid format ({expected}): “{value}”.',
  },
  'date.end-before-start': {
    es: 'La fecha de fin ({end}) es anterior a la de inicio ({start}).',
    en: 'The end date ({end}) is earlier than the start date ({start}).',
  },
  'date.ongoing-with-end': {
    es: 'Está marcada como actual y además tiene fecha de fin ({end}).',
    en: 'It is marked as current and also has an end date ({end}).',
  },
  'experience.multiple-current': {
    es: 'Hay {count} experiencias marcadas como actuales.',
    en: 'There are {count} experiences marked as current.',
  },
  'i18n.missing-translation': {
    es: 'Falta el texto en {localeName} de {field}.',
    en: 'The {localeName} text for {field} is missing.',
  },
  'i18n.highlights-count-mismatch': {
    es: 'Los logros tienen {es} ítems en español y {en} en inglés.',
    en: 'Highlights have {es} items in Spanish and {en} in English.',
  },
  'url.invalid': {
    es: '{field} no es una URL válida{httpsOnly}.',
    en: '{field} is not a valid URL{httpsOnly}.',
  },
  'url.not-https': {
    es: '{field} usa http; conviene https.',
    en: '{field} uses http; https is preferable.',
  },
  'certification.expired': {
    es: 'Venció en {expiresAt}: el sitio la muestra como «Vencida».',
    en: 'Expired in {expiresAt}: the site shows it as “Expired”.',
  },
  'curated.orphan-reference': {
    es: '{list} incluye el id {id}, que no corresponde a ninguna experiencia, skill ni proyecto.',
    en: '{list} includes the id {id}, which does not match any experience, skill or project.',
  },
  'curated.conflicting-reference': {
    es: 'El id {id} está en includeIds y en excludeIds; gana la exclusión.',
    en: 'The id {id} is in both includeIds and excludeIds; the exclusion wins.',
  },
  'curated.unmatched-filter-tag': {
    es: 'El tag «{tag}» no coincide con ninguna experiencia, skill ni proyecto visible.',
    en: 'The tag “{tag}” does not match any visible experience, skill or project.',
  },
  'curated.no-experiences': {
    es: 'Con sus criterios actuales no muestra ninguna experiencia.',
    en: 'With its current criteria it shows no experiences.',
  },
};

/** Variables que la plantilla puede usar además de los `params` de la regla. */
export const DERIVED_TEMPLATE_VARIABLES = ['field', 'localeName', 'httpsOnly'] as const;

const LOCALE_NAMES: Readonly<Record<Locale, Readonly<Record<Locale, string>>>> = {
  es: { es: 'español', en: 'inglés' },
  en: { es: 'Spanish', en: 'English' },
};
const HTTPS_ONLY: Readonly<Record<Locale, string>> = {
  es: ' (tiene que ser https)',
  en: ' (must be https)',
};

function isLocale(value: string | number | undefined): value is Locale {
  return value === 'es' || value === 'en';
}

/** Variables de interpolación de un hallazgo en un idioma. */
function variablesOf(found: CvIssue, locale: Locale): Record<string, string | number> {
  const locales = LOCALE_NAMES[locale];
  const subject = found.params.locale;
  return {
    ...found.params,
    field: found.field ?? '',
    localeName: isLocale(subject) ? locales[subject] : '',
    httpsOnly: found.entityType === 'certification' ? HTTPS_ONLY[locale] : '',
  };
}

function interpolate(template: string, variables: CvIssueParams): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in variables ? String(variables[name]) : whole,
  );
}

/** Mensaje de un hallazgo en el idioma pedido. */
export function cvIssueMessage(found: CvIssue, locale: Locale): string {
  return interpolate(CV_ISSUE_TEMPLATES[found.code][locale], variablesOf(found, locale));
}

/** Nombres de variable `{x}` de la plantilla de un código (en cualquier idioma). */
export function templateVariables(code: CvIssueCode, locale: Locale): string[] {
  const names = [...CV_ISSUE_TEMPLATES[code][locale].matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  return [...new Set(names)];
}

const text = (field: LocalizedField, locale: Locale): string =>
  resolveLocale(
    Array.isArray(field) ? null : (field as Parameters<typeof resolveLocale>[0]),
    locale,
  );

/**
 * Nombre legible del ítem de un hallazgo (D8): empresa de la experiencia, título de la
 * formación, nombre de la certificación, del proyecto o de la skill, plataforma del enlace,
 * slug del perfil curado, y nombre del perfil o del idioma. Si el ítem ya no está en la
 * instantánea, cae al id.
 */
export function cvEntityLabel(snapshot: CvSnapshot, found: CvIssue, locale: Locale): string {
  const id = found.entityId;
  let label: string | undefined;
  switch (found.entityType) {
    case 'profile':
      label = snapshot.profile?.fullName;
      break;
    case 'language': {
      const language = snapshot.languages.find((l) => l.id === id);
      label = language && (text(language.nameI18n, locale) || language.name);
      break;
    }
    case 'experience':
      label = snapshot.experiences.find((e) => e.id === id)?.company;
      break;
    case 'skillCategory': {
      const category = snapshot.skillCategories.find((c) => c.id === id);
      label = category && text(category.name, locale);
      break;
    }
    case 'skill':
      label = snapshot.skillCategories.flatMap((c) => c.skills).find((s) => s.id === id)?.name;
      break;
    case 'education': {
      const education = snapshot.education.find((e) => e.id === id);
      label = education && (text(education.degree, locale) || education.institution);
      break;
    }
    case 'certification': {
      const certification = snapshot.certifications.find((c) => c.id === id);
      label = certification && (text(certification.name, locale) || certification.issuer);
      break;
    }
    case 'project':
      label = snapshot.projects.find((p) => p.id === id)?.name;
      break;
    case 'socialLink':
      label = snapshot.socialLinks.find((l) => l.id === id)?.platform;
      break;
    case 'curatedProfile':
      label = snapshot.curatedProfiles.find((c) => c.id === id)?.slug;
      break;
  }
  return label !== undefined && label !== '' ? label : id;
}

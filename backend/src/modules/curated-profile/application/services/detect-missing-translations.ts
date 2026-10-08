import {
  Locale,
  LocalizedList,
  LocalizedText,
  SUPPORTED_LOCALES,
} from '../../../../shared/domain/i18n';
import { Certification } from '../../../education/domain/entities/certification.entity';
import { Education } from '../../../education/domain/entities/education.entity';
import { Experience } from '../../../experience/domain/entities/experience.entity';
import { Profile } from '../../../profile/domain/entities/profile.entity';
import { Project } from '../../../project/domain/entities/project.entity';
import { SkillCategory } from '../../../skill/domain/entities/skill-category.entity';
import { SocialLink } from '../../../social-link/domain/entities/social-link.entity';
import { CuratedProfile } from '../../domain/entities/curated-profile.entity';

export type MissingTranslationEntity =
  | 'curatedProfile'
  | 'profile'
  | 'experience'
  | 'skillCategory'
  | 'project'
  | 'education'
  | 'certification'
  | 'socialLink';

/** Un campo bilingüe que, en el idioma pedido, caería al fallback por estar vacío. */
export interface MissingTranslation {
  entity: MissingTranslationEntity;
  id: string;
  /** Nombre del campo; los anidados van con punto (`availability.modality`). */
  field: string;
}

/**
 * Entidades de dominio ya seleccionadas por el composer (las mismas que alimentan
 * el DTO de presentación). El DTO resuelto no sirve: ahí "falta" y "es igual al
 * español" son indistinguibles.
 */
export interface MissingTranslationsInput {
  locale: Locale;
  curated: CuratedProfile;
  profile: Profile | null;
  experiences: readonly Experience[];
  skillCategories: readonly SkillCategory[];
  projects: readonly Project[];
  education: readonly Education[];
  certifications: readonly Certification[];
  socialLinks: readonly SocialLink[];
}

type Localized = LocalizedText | LocalizedList | string | string[] | null | undefined;

const isBlank = (value: string | string[] | undefined): boolean =>
  value === undefined ||
  (typeof value === 'string' ? value.trim() === '' : value.every((item) => item.trim() === ''));

/**
 * Regla D4 (`add-bilingual-builder-parity`): un campo falta cuando está ausente,
 * vacío o es una lista vacía en `locale` Y tiene contenido en otro idioma.
 * - Igual al otro idioma NO es faltante (`Tech Lead`, `.NET`).
 * - Vacío en todos los idiomas (opcional sin llenar, p. ej. el headline del
 *   perfil curado `all`, que hereda el del perfil base) NO es faltante.
 * - Un dato plano legado (string / string[]) no se reporta.
 */
function isMissing(field: Localized, locale: Locale): boolean {
  if (field == null || typeof field === 'string' || Array.isArray(field)) return false;
  const byLocale = field as Partial<Record<Locale, string | string[]>>;
  if (!isBlank(byLocale[locale])) return false;
  return SUPPORTED_LOCALES.some((other) => other !== locale && !isBlank(byLocale[other]));
}

/**
 * Detecta los campos bilingües sin contenido en el idioma pedido. Función pura
 * (sin Prisma ni Nest). Campos cubiertos por entidad:
 * - curatedProfile: title, headline, description, roleType
 * - profile: headline, summary, availability.modality, availability.contractType,
 *   availability.startDate
 * - experience: role, summary, highlights
 * - skillCategory: name
 * - project: role, summary
 * - education: degree
 * - certification: name
 * - socialLink: label, description
 * No cubre idiomas hablados del perfil ni las skills (nombres planos).
 */
export function detectMissingTranslations(input: MissingTranslationsInput): MissingTranslation[] {
  const { locale } = input;
  const found: MissingTranslation[] = [];
  const check = (
    entity: MissingTranslationEntity,
    id: string,
    fields: Record<string, Localized>,
  ): void => {
    for (const [field, value] of Object.entries(fields)) {
      if (isMissing(value, locale)) found.push({ entity, id, field });
    }
  };

  const { curated, profile } = input;
  check('curatedProfile', curated.id, {
    title: curated.title,
    headline: curated.headline,
    description: curated.description,
    roleType: curated.roleType,
  });
  if (profile) {
    check('profile', profile.id, {
      headline: profile.headline,
      summary: profile.summary,
      'availability.modality': profile.availability.modality,
      'availability.contractType': profile.availability.contractType,
      'availability.startDate': profile.availability.startDate,
    });
  }
  for (const e of input.experiences) {
    check('experience', e.id, { role: e.role, summary: e.summary, highlights: e.highlights });
  }
  for (const c of input.skillCategories) check('skillCategory', c.id, { name: c.name });
  for (const p of input.projects) check('project', p.id, { role: p.role, summary: p.summary });
  for (const e of input.education) check('education', e.id, { degree: e.degree });
  for (const c of input.certifications) check('certification', c.id, { name: c.name });
  for (const s of input.socialLinks) {
    check('socialLink', s.id, { label: s.label, description: s.description });
  }
  return found;
}

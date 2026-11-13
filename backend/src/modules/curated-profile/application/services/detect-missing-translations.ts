import { Locale, LocalizedField, isMissingTranslation } from '../../../../shared/domain/i18n';
import { Certification } from '../../../education/domain/entities/certification.entity';
import { Education } from '../../../education/domain/entities/education.entity';
import { FeaturedRepository } from '../../../featured-repository/domain/entities/featured-repository.entity';
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
  | 'repository'
  | 'education'
  | 'certification'
  | 'socialLink'
  | 'language';

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
  repositories: readonly FeaturedRepository[];
  education: readonly Education[];
  certifications: readonly Certification[];
  socialLinks: readonly SocialLink[];
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
 * - repository: description
 * - education: degree
 * - certification: name
 * - socialLink: label, description
 * - language (idiomas del perfil, localize-language-level D7): nameI18n, level, detail
 * No cubre las skills (nombres planos).
 */
export function detectMissingTranslations(input: MissingTranslationsInput): MissingTranslation[] {
  const { locale } = input;
  const found: MissingTranslation[] = [];
  const check = (
    entity: MissingTranslationEntity,
    id: string,
    fields: Record<string, LocalizedField>,
  ): void => {
    for (const [field, value] of Object.entries(fields)) {
      if (isMissingTranslation(value, locale)) found.push({ entity, id, field });
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
    for (const l of profile.languages) {
      check('language', l.id, { nameI18n: l.nameI18n, level: l.level, detail: l.detail });
    }
  }
  for (const e of input.experiences) {
    check('experience', e.id, { role: e.role, summary: e.summary, highlights: e.highlights });
  }
  for (const c of input.skillCategories) check('skillCategory', c.id, { name: c.name });
  for (const p of input.projects) check('project', p.id, { role: p.role, summary: p.summary });
  for (const r of input.repositories) check('repository', r.id, { description: r.description });
  for (const e of input.education) check('education', e.id, { degree: e.degree });
  for (const c of input.certifications) check('certification', c.id, { name: c.name });
  for (const s of input.socialLinks) {
    check('socialLink', s.id, { label: s.label, description: s.description });
  }
  return found;
}

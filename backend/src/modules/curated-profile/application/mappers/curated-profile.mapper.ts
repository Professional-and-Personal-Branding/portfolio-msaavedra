import { Locale, resolveLocale } from '../../../../shared/domain/i18n';
import {
  toCertificationOutput,
  toEducationOutput,
} from '../../../education/application/mappers/education.mapper';
import { Certification } from '../../../education/domain/entities/certification.entity';
import { Education } from '../../../education/domain/entities/education.entity';
import { toExperienceOutput } from '../../../experience/application/mappers/experience.mapper';
import { Experience } from '../../../experience/domain/entities/experience.entity';
import { toProfileOutput } from '../../../profile/application/mappers/profile.mapper';
import { Profile } from '../../../profile/domain/entities/profile.entity';
import { toProjectOutput } from '../../../project/application/mappers/project.mapper';
import { Project } from '../../../project/domain/entities/project.entity';
import { SkillCategory } from '../../../skill/domain/entities/skill-category.entity';
import { toSocialLinkOutput } from '../../../social-link/application/mappers/social-link.mapper';
import { SocialLink } from '../../../social-link/domain/entities/social-link.entity';
import { Theme, ThemeTokens } from '../../../theme/domain/entities/theme.entity';
import { CuratedProfile } from '../../domain/entities/curated-profile.entity';
import { ResolvedSections } from '../../domain/services/resolve-sections';
import {
  CuratedProfileOutput,
  CuratedProfileSummaryOutput,
  ResolvedThemeOutput,
  SkillCategoryOutput,
} from '../dto/curated-profile.output';

export function toCuratedProfileSummary(
  curated: CuratedProfile,
  locale: Locale,
): CuratedProfileSummaryOutput {
  return {
    slug: curated.slug,
    title: resolveLocale(curated.title, locale),
    headline: resolveLocale(curated.headline, locale),
    description: resolveLocale(curated.description, locale),
    roleType: resolveLocale(curated.roleType, locale),
    techFocus: curated.techFocus,
    accentColor: curated.accentColor,
    layout: curated.layout,
  };
}

export function toSkillCategoryOutput(
  category: SkillCategory,
  locale: Locale,
): SkillCategoryOutput {
  return {
    name: resolveLocale(category.name, locale),
    skills: category.skills.map((s) => s.name),
  };
}

export function toResolvedThemeOutput(theme: Theme, tokens: ThemeTokens): ResolvedThemeOutput {
  return { slug: theme.slug, name: theme.name, isPreset: theme.isPreset, tokens };
}

export interface CuratedProfileResolution {
  curated: CuratedProfile;
  locale: Locale;
  profile: Profile | null;
  /** Ya seleccionadas y ordenadas. */
  experiences: readonly Experience[];
  /** Ya filtradas (sin categorías vacías). */
  skillCategories: readonly SkillCategory[];
  /** Ya seleccionados por tags/overrides. */
  projects: readonly Project[];
  education: readonly Education[];
  certifications: readonly Certification[];
  socialLinks: readonly SocialLink[];
  theme: { theme: Theme; tokens: ThemeTokens } | null;
  sections: ResolvedSections;
}

export function toCuratedProfileOutput(r: CuratedProfileResolution): CuratedProfileOutput {
  const l = r.locale;
  return {
    ...toCuratedProfileSummary(r.curated, l),
    visibility: r.curated.visibility,
    sections: [...r.sections.sections],
    hiddenSections: [...r.sections.hiddenSections],
    theme: r.theme ? toResolvedThemeOutput(r.theme.theme, r.theme.tokens) : null,
    profile: r.profile ? toProfileOutput(r.profile, l) : null,
    experiences: r.experiences.map((e) => toExperienceOutput(e, l)),
    skillCategories: r.skillCategories.map((c) => toSkillCategoryOutput(c, l)),
    projects: r.projects.map((p) => toProjectOutput(p, l)),
    education: r.education.map((e) => toEducationOutput(e, l)),
    certifications: r.certifications.map((c) => toCertificationOutput(c, l)),
    socialLinks: r.socialLinks.map((s) => toSocialLinkOutput(s, l)),
  };
}

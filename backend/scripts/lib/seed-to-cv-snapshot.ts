/**
 * Traduce la fuente del seed ya validada (`parseSeedSource`) a la instantánea que miran las reglas
 * de consistencia del CV (D13 de `add-cv-consistency-rules`). Módulo puro: sin base ni archivos,
 * y sin `@prisma/client`.
 *
 * Ids de los hallazgos: la clave del seed cuando existe (`experience:<id>`, `project:<id>`, `repository:<id>` y el
 * `slug` de cada perfil curado, incluido `all`) o una posicional con el índice base 0 del arreglo
 * (`certification#4`, `education#0`, `skillCategory#3`, `skill#3.2` = categoría 3, skill 2).
 */
import { CvSnapshot } from '../../src/modules/cv-consistency/domain/cv-snapshot';
import { tagsForSkillCategory } from './seed-defaults';
import { ALL_PROFILE_SLUG, parseRef, SeedSource, skillName } from './seed-source';

export function seedToCvSnapshot(source: SeedSource): CvSnapshot {
  const { profile } = source;

  const skillCategories = source.skillCategories.map((category, ci) => {
    const categoryTags = category.tags ?? tagsForSkillCategory(category.name.es);
    return {
      id: `skillCategory#${ci}`,
      name: category.name,
      skills: category.skills.map((skill, si) => ({
        id: `skill#${ci}.${si}`,
        name: skillName(skill),
        tags: typeof skill === 'string' ? categoryTags : (skill.tags ?? categoryTags),
      })),
    };
  });

  // `skill:<nombre>` → id posicional de la primera skill con ese nombre (el parser rechaza las ambiguas).
  const skillIdByName = new Map<string, string>();
  for (const category of skillCategories) {
    for (const skill of category.skills) {
      if (!skillIdByName.has(skill.name)) skillIdByName.set(skill.name, skill.id);
    }
  }
  /** Una referencia que no se resuelve queda tal cual: así las reglas la ven como huérfana. */
  const resolveRef = (ref: string): string => {
    const parsed = parseRef(ref);
    if (parsed?.kind === 'skill') return skillIdByName.get(parsed.key) ?? ref;
    return ref;
  };

  return {
    profile: {
      id: 'profile',
      fullName: profile.fullName,
      yearsOfExperience: profile.yearsOfExperience,
      headline: profile.headline,
      summary: profile.summary,
      availabilityModality: profile.availability.modality,
      availabilityContractType: profile.availability.contractType,
      availabilityStartDate: profile.availability.startDate,
    },
    languages: profile.languages.map((language, i) => ({
      id: `language#${i}`,
      name: language.name,
      nameI18n: language.nameI18n,
      level: language.level,
      detail: language.detail,
    })),
    experiences: source.experiences.map((e) => ({
      id: `experience:${e.id}`,
      company: e.company,
      startDate: e.startDate,
      endDate: e.endDate,
      current: e.current,
      visible: e.visible ?? true,
      tags: e.tags,
      role: e.role,
      summary: e.summary,
      highlights: e.highlights,
    })),
    skillCategories,
    education: source.education.map((e, i) => ({
      id: `education#${i}`,
      institution: e.institution,
      startDate: e.startDate,
      endDate: e.endDate,
      inProgress: e.inProgress,
      visible: e.visible ?? true,
      degree: e.degree,
    })),
    certifications: source.certifications.map((c, i) => ({
      id: `certification#${i}`,
      issuer: c.issuer,
      year: c.year,
      verificationUrl: c.verificationUrl ?? null,
      expiresAt: c.expiresAt ?? null,
      visible: c.visible ?? true,
      name: c.name,
    })),
    projects: source.projects.map((p) => ({
      id: `project:${p.id}`,
      name: p.name,
      url: p.url,
      visible: p.visible ?? true,
      tags: p.tags,
      role: p.role,
      summary: p.summary,
    })),
    repositories: (profile.featuredRepositories ?? []).map((r, i) => ({
      // La clave del seed si la tiene (`repository:<id>`, la que referencian las plantillas) o la posicional.
      id: r.id === undefined ? `repository#${i}` : `repository:${r.id}`,
      name: r.name,
      visible: r.visible,
      tags: r.tags,
      description: r.description,
    })),
    socialLinks: (profile.socialLinks ?? []).map((l, i) => ({
      id: `socialLink#${i}`,
      platform: l.platform,
      url: l.url,
      visible: l.visible,
      label: l.label,
      description: l.description,
    })),
    curatedProfiles: [
      // El perfil `all` lo crea el seed con estos valores fijos (seed-runner).
      {
        id: ALL_PROFILE_SLUG,
        slug: ALL_PROFILE_SLUG,
        archived: false,
        filterTags: [],
        includeIds: [],
        excludeIds: [],
        title: { es: 'Perfil Completo', en: 'Full Profile' },
        headline: {},
        description: {
          es: 'Vista completa del portafolio profesional.',
          en: 'Complete view of the professional portfolio.',
        },
        roleType: null,
      },
      ...source.profileTemplates.map((template) => ({
        id: template.slug,
        slug: template.slug,
        archived: template.archived ?? false,
        filterTags: template.filterTags,
        includeIds: (template.includeRefs ?? []).map(resolveRef),
        excludeIds: (template.excludeRefs ?? []).map(resolveRef),
        title: template.title,
        headline: template.headline,
        description: template.description,
        roleType: template.roleType ?? null,
      })),
    ],
  };
}

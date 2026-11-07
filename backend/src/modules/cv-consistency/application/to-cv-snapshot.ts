import { Certification } from '../../education/domain/entities/certification.entity';
import { Education } from '../../education/domain/entities/education.entity';
import { CuratedProfile } from '../../curated-profile/domain/entities/curated-profile.entity';
import { Experience } from '../../experience/domain/entities/experience.entity';
import { Profile } from '../../profile/domain/entities/profile.entity';
import { Project } from '../../project/domain/entities/project.entity';
import { SkillCategory } from '../../skill/domain/entities/skill-category.entity';
import { SocialLink } from '../../social-link/domain/entities/social-link.entity';
import { CvSnapshot } from '../domain/cv-snapshot';

/** Lo que el caso de uso lee de los siete módulos (una consulta por repositorio). */
export interface CvSources {
  readonly profile: Profile | null;
  readonly experiences: readonly Experience[];
  readonly skillCategories: readonly SkillCategory[];
  readonly education: readonly Education[];
  readonly certifications: readonly Certification[];
  readonly projects: readonly Project[];
  readonly socialLinks: readonly SocialLink[];
  readonly curatedProfiles: readonly CuratedProfile[];
}

/** Entidades de dominio → instantánea de solo lectura que miran las reglas (D1). */
export function toCvSnapshot(sources: CvSources): CvSnapshot {
  const { profile } = sources;
  return {
    profile: profile && {
      id: profile.id,
      fullName: profile.fullName,
      yearsOfExperience: profile.yearsOfExperience,
      headline: profile.headline,
      summary: profile.summary,
      availabilityModality: profile.availability.modality,
      availabilityContractType: profile.availability.contractType,
      availabilityStartDate: profile.availability.startDate,
    },
    languages: (profile?.languages ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      nameI18n: l.nameI18n,
      level: l.level,
      detail: l.detail,
    })),
    experiences: sources.experiences.map((e) => ({
      id: e.id,
      company: e.company,
      startDate: e.startDate,
      endDate: e.endDate,
      current: e.current,
      visible: e.visible,
      tags: e.tags,
      role: e.role,
      summary: e.summary,
      highlights: e.highlights,
    })),
    skillCategories: sources.skillCategories.map((c) => ({
      id: c.id,
      name: c.name,
      skills: c.skills.map((s) => ({ id: s.id, name: s.name, tags: s.tags })),
    })),
    education: sources.education.map((e) => ({
      id: e.id,
      institution: e.institution,
      startDate: e.startDate,
      endDate: e.endDate,
      inProgress: e.inProgress,
      visible: e.visible,
      degree: e.degree,
    })),
    certifications: sources.certifications.map((c) => ({
      id: c.id,
      issuer: c.issuer,
      year: c.year,
      verificationUrl: c.verificationUrl,
      expiresAt: c.expiresAt,
      visible: c.visible,
      name: c.name,
    })),
    projects: sources.projects.map((p) => ({
      id: p.id,
      name: p.name,
      url: p.url,
      visible: p.visible,
      tags: p.tags,
      role: p.role,
      summary: p.summary,
    })),
    socialLinks: sources.socialLinks.map((l) => ({
      id: l.id,
      platform: l.platform,
      url: l.url,
      visible: l.visible,
      label: l.label,
      description: l.description,
    })),
    curatedProfiles: sources.curatedProfiles.map((c) => ({
      id: c.id,
      slug: c.slug,
      archived: c.isArchived,
      filterTags: c.filterTags,
      includeIds: c.includeIds,
      excludeIds: c.excludeIds,
      title: c.title,
      headline: c.headline,
      description: c.description,
      roleType: c.roleType,
    })),
  };
}

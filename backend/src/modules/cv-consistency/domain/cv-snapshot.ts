import { LocalizedField } from '../../../shared/domain/i18n';

/**
 * Instantánea de solo lectura del CV que las reglas miran (D1 de `add-cv-consistency-rules`).
 * Son datos planos: las reglas no conocen las entidades ni el JSON del seed. Los campos
 * bilingües conservan la forma del dominio (`{es,en}`, lista o dato plano legado).
 */
export interface CvProfileSnapshot {
  readonly id: string;
  readonly fullName: string;
  readonly yearsOfExperience: number;
  readonly headline: LocalizedField;
  readonly summary: LocalizedField;
  readonly availabilityModality: LocalizedField;
  readonly availabilityContractType: LocalizedField;
  readonly availabilityStartDate: LocalizedField;
}

export interface CvLanguageSnapshot {
  readonly id: string;
  /** Nombre canónico (no traducible): etiqueta de respaldo si falta `nameI18n`. */
  readonly name: string;
  readonly nameI18n: LocalizedField;
  readonly level: LocalizedField;
  readonly detail: LocalizedField;
}

export interface CvExperienceSnapshot {
  readonly id: string;
  readonly company: string;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly current: boolean;
  readonly visible: boolean;
  readonly tags: readonly string[];
  readonly role: LocalizedField;
  readonly summary: LocalizedField;
  readonly highlights: LocalizedField;
}

export interface CvSkillSnapshot {
  readonly id: string;
  readonly name: string;
  readonly tags: readonly string[];
}

export interface CvSkillCategorySnapshot {
  readonly id: string;
  readonly name: LocalizedField;
  readonly skills: readonly CvSkillSnapshot[];
}

export interface CvEducationSnapshot {
  readonly id: string;
  readonly institution: string;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly inProgress: boolean;
  readonly visible: boolean;
  readonly degree: LocalizedField;
}

export interface CvCertificationSnapshot {
  readonly id: string;
  readonly issuer: string;
  readonly year: string | null;
  readonly verificationUrl: string | null;
  readonly expiresAt: string | null;
  readonly visible: boolean;
  readonly name: LocalizedField;
}

export interface CvProjectSnapshot {
  readonly id: string;
  readonly name: string;
  readonly url: string | null;
  readonly visible: boolean;
  readonly tags: readonly string[];
  readonly role: LocalizedField;
  readonly summary: LocalizedField;
}

export interface CvRepositorySnapshot {
  readonly id: string;
  readonly name: string;
  readonly visible: boolean;
  readonly tags: readonly string[];
  readonly description: LocalizedField;
}

export interface CvSocialLinkSnapshot {
  readonly id: string;
  readonly platform: string;
  readonly url: string;
  readonly visible: boolean;
  readonly label: LocalizedField;
  readonly description: LocalizedField;
}

export interface CvCuratedProfileSnapshot {
  readonly id: string;
  readonly slug: string;
  readonly archived: boolean;
  readonly filterTags: readonly string[];
  readonly includeIds: readonly string[];
  readonly excludeIds: readonly string[];
  readonly title: LocalizedField;
  readonly headline: LocalizedField;
  readonly description: LocalizedField;
  readonly roleType: LocalizedField;
}

export interface CvSnapshot {
  /** `null` si todavía no hay perfil base (base vacía): las reglas que lo necesitan no emiten. */
  readonly profile: CvProfileSnapshot | null;
  readonly languages: readonly CvLanguageSnapshot[];
  readonly experiences: readonly CvExperienceSnapshot[];
  readonly skillCategories: readonly CvSkillCategorySnapshot[];
  readonly education: readonly CvEducationSnapshot[];
  readonly certifications: readonly CvCertificationSnapshot[];
  readonly projects: readonly CvProjectSnapshot[];
  readonly repositories: readonly CvRepositorySnapshot[];
  readonly socialLinks: readonly CvSocialLinkSnapshot[];
  readonly curatedProfiles: readonly CvCuratedProfileSnapshot[];
}

import type { components } from './api';

/** Aliases de los schemas del contrato que consume la vista pública. */
type Schemas = components['schemas'];

export type CuratedProfile = Schemas['CuratedProfileResponse'];
export type PreviewCuratedProfile = Schemas['PreviewCuratedProfileResponse'];
export type MissingTranslation = Schemas['MissingTranslationResponse'];
export type CuratedProfileSummary = Schemas['CuratedProfileSummaryResponse'];
export type Profile = Schemas['ProfileResponse'];
export type Experience = Schemas['ExperienceResponse'];
export type SkillCategory = Schemas['SkillCategoryResponse'];
export type Project = Schemas['ProjectResponse'];
export type FeaturedRepository = Schemas['FeaturedRepositoryResponse'];
export type Education = Schemas['EducationResponse'];
export type Certification = Schemas['CertificationResponse'];
export type SocialLink = Schemas['SocialLinkResponse'];
export type ResolvedTheme = Schemas['ResolvedThemeResponse'];
export type ApiError = Schemas['ErrorResponseDto'];

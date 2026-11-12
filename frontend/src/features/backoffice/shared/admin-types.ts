import type { components } from '@/shared/types/api';

type Schemas = components['schemas'];

export type LocalizedText = Schemas['LocalizedTextDto'];
export type LocalizedList = Schemas['LocalizedListDto'];

export type AdminExperience = Schemas['AdminExperienceResponse'];
export type CreateExperienceBody = Schemas['CreateExperienceDto'];
export type UpdateExperienceBody = Schemas['UpdateExperienceDto'];

export type AdminSkillCategory = Schemas['AdminSkillCategoryResponse'];
export type AdminSkill = Schemas['AdminSkillResponse'];
export type CreateSkillCategoryBody = Schemas['CreateSkillCategoryDto'];
export type CreateSkillBody = Schemas['CreateSkillDto'];

export type AdminCuratedProfile = Schemas['AdminCuratedProfileResponse'];
export type CreateCuratedProfileBody = Schemas['CreateCuratedProfileDto'];
export type UpdateCuratedProfileBody = Schemas['UpdateCuratedProfileDto'];

// add-profile-content-admin: perfil base, idiomas, formación, proyectos y enlaces.
export type AdminProfile = Schemas['AdminProfileResponse'];
export type ReplaceProfileBody = Schemas['ReplaceProfileDto'];
export type ProfilePreview = Schemas['ProfileResponse'];
export type AdminLanguage = Schemas['AdminLanguageResponse'];
export type CreateLanguageBody = Schemas['CreateLanguageDto'];
export type UpdateLanguageBody = Schemas['UpdateLanguageDto'];
export type AdminEducation = Schemas['AdminEducationResponse'];
export type CreateEducationBody = Schemas['CreateEducationDto'];
export type UpdateEducationBody = Schemas['UpdateEducationDto'];
export type AdminCertification = Schemas['AdminCertificationResponse'];
export type CreateCertificationBody = Schemas['CreateCertificationDto'];
export type UpdateCertificationBody = Schemas['UpdateCertificationDto'];
export type AdminProject = Schemas['AdminProjectResponse'];
export type CreateProjectBody = Schemas['CreateProjectDto'];
export type UpdateProjectBody = Schemas['UpdateProjectDto'];
export type AdminSocialLink = Schemas['AdminSocialLinkResponse'];
export type CreateSocialLinkBody = Schemas['CreateSocialLinkDto'];
export type UpdateSocialLinkBody = Schemas['UpdateSocialLinkDto'];

// add-share-links: enlaces de seguimiento de un perfil.
export type ShareLink = Schemas['ShareLinkResponse'];
export type CreateShareLinkBody = Schemas['CreateShareLinkDto'];

// add-application-tracking: postulaciones (CRM personal del panel).
export type Application = Schemas['ApplicationResponse'];
export type ApplicationStatus = Schemas['ApplicationStatus'];
export type ApplicationSummary = Schemas['ApplicationSummaryResponse'];
export type CreateApplicationBody = Schemas['CreateApplicationDto'];
export type UpdateApplicationBody = Schemas['UpdateApplicationDto'];

// add-job-posting-intake: vacantes importadas y borrador de perfil desde una vacante.
export type JobPosting = Schemas['JobPostingResponse'];
export type JobPostingSuggestion = Schemas['JobPostingSuggestionResponse'];
export type ImportJobPostingBody = Schemas['ImportJobPostingDto'];
export type CreateFromJobPostingBody = Schemas['CreateCuratedProfileFromJobPostingDto'];

// add-cv-consistency-rules: revisión de consistencia del CV.
export type CvConsistency = Schemas['CvConsistencyResponse'];
export type CvIssue = Schemas['CvIssueResponse'];
export type CvSeverity = Schemas['CvSeverity'];
export type CvEntityType = Schemas['CvEntityType'];

export type AdminTheme = Schemas['ThemeResponse'];
export type ProfileViews = Schemas['ProfileViewsResponse'];
export type Visibility = AdminCuratedProfile['visibility'];

/** Texto localizado en español, con fallback al inglés (listados del panel). */
export function es(value: LocalizedText | undefined | null): string {
  return value?.es ?? value?.en ?? '';
}

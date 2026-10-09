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
// `accentColor` está obsoleto (D9 de `polish-builder-and-edge`): el generador lo
// marca requerido por su `default`, pero el panel no lo envía y la API lo
// completa, así que en el cuerpo es opcional.
export type CreateCuratedProfileWire = Schemas['CreateCuratedProfileDto'];
export type UpdateCuratedProfileWire = Schemas['UpdateCuratedProfileDto'];
export type CreateCuratedProfileBody = Omit<Schemas['CreateCuratedProfileDto'], 'accentColor'> & {
  accentColor?: string;
};
export type UpdateCuratedProfileBody = Omit<Schemas['UpdateCuratedProfileDto'], 'accentColor'> & {
  accentColor?: string;
};

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

export type AdminTheme = Schemas['ThemeResponse'];
export type ProfileViews = Schemas['ProfileViewsResponse'];
export type Visibility = AdminCuratedProfile['visibility'];

/** Texto localizado en español, con fallback al inglés (listados del panel). */
export function es(value: LocalizedText | undefined | null): string {
  return value?.es ?? value?.en ?? '';
}

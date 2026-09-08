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

export type AdminTheme = Schemas['ThemeResponse'];
export type ProfileViews = Schemas['ProfileViewsResponse'];
export type Visibility = AdminCuratedProfile['visibility'];

/** Texto localizado en español, con fallback al inglés (listados del panel). */
export function es(value: LocalizedText | undefined | null): string {
  return value?.es ?? value?.en ?? '';
}

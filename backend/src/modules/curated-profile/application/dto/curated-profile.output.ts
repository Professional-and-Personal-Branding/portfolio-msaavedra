import { ExperienceOutput } from '../../../experience/application/dto/experience.output';
import { ProfileOutput } from '../../../profile/application/dto/profile.output';
import { CuratedVisibility } from '../../domain/entities/curated-profile.entity';

/** Elemento del listado (menú de navegación). Sin filterTags ni overrides. */
export interface CuratedProfileSummaryOutput {
  slug: string;
  title: string;
  headline: string;
  description: string;
  roleType: string;
  techFocus: string | null;
  accentColor: string;
  layout: string;
}

export interface ResolvedThemeOutput {
  slug: string;
  name: string;
  isPreset: boolean;
  tokens: Record<string, unknown>;
}

export interface SkillCategoryOutput {
  name: string;
  skills: string[];
}

/** Vista resuelta, lista para el frontend (spec `curated-profile-resolution`). */
export interface CuratedProfileOutput extends CuratedProfileSummaryOutput {
  visibility: CuratedVisibility;
  sections: string[];
  hiddenSections: string[];
  theme: ResolvedThemeOutput | null;
  profile: ProfileOutput | null;
  experiences: ExperienceOutput[];
  skillCategories: SkillCategoryOutput[];
}

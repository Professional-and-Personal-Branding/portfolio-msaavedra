import type { ComponentType } from 'react';
import { Certifications } from '@/shared/components/portfolio/Certifications';
import { Contact } from '@/shared/components/portfolio/Contact';
import { Education } from '@/shared/components/portfolio/Education';
import { ExperienceTimeline } from '@/shared/components/portfolio/ExperienceTimeline';
import { Hero } from '@/shared/components/portfolio/Hero';
import { Presence } from '@/shared/components/portfolio/Presence';
import { Projects } from '@/shared/components/portfolio/Projects';
import { SkillsGrid } from '@/shared/components/portfolio/SkillsGrid';
import { Stats } from '@/shared/components/portfolio/Stats';
import type { SectionProps } from '@/shared/components/portfolio/types';
import type { SectionId } from './sections';

/** Cada sección conocida → su componente. Todos reciben el perfil curado completo. */
export const SECTION_COMPONENTS: Record<SectionId, ComponentType<SectionProps>> = {
  hero: Hero,
  stats: Stats,
  experience: ExperienceTimeline,
  skills: SkillsGrid,
  projects: Projects,
  education: Education,
  certifications: Certifications,
  presence: Presence,
  contact: Contact,
};

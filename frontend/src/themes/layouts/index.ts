import type { ComponentType } from 'react';
import type { CuratedProfile } from '@/shared/types/portfolio';
import { ClassicLayout } from './ClassicLayout';
import type { SectionId } from './sections';
import { SidebarLayout } from './SidebarLayout';

export interface LayoutProps {
  data: CuratedProfile;
  /** Secciones en el orden final que resolvió el backend (`renderableSections`). */
  sections: readonly SectionId[];
}

/** Registro de layouts estructurales (spec `layout-engine`, decisión D5). */
export const LAYOUTS = {
  classic: ClassicLayout,
  sidebar: SidebarLayout,
} as const satisfies Record<string, ComponentType<LayoutProps>>;

export type LayoutName = keyof typeof LAYOUTS;
export const LAYOUT_NAMES = Object.keys(LAYOUTS) as LayoutName[];
export const DEFAULT_LAYOUT: LayoutName = 'classic';

export function isLayoutName(value: unknown): value is LayoutName {
  return typeof value === 'string' && value in LAYOUTS;
}

/** Un valor desconocido cae a `classic`. */
export function resolveLayoutName(name: string | null | undefined): LayoutName {
  return isLayoutName(name) ? name : DEFAULT_LAYOUT;
}

export function resolveLayout(name: string | null | undefined): ComponentType<LayoutProps> {
  return LAYOUTS[resolveLayoutName(name)];
}

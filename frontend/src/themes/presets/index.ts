import { corporate } from './corporate';
import { elegant } from './elegant';
import { minimal } from './minimal';
import { modernDark } from './modern-dark';
import { modernLight } from './modern-light';
import type { ThemePreset } from './types';

export type { ThemePreset } from './types';

/** Los cinco presets del seed, en el orden del selector (spec `runtime-theming`). */
export const THEME_PRESETS: readonly ThemePreset[] = [
  modernDark,
  modernLight,
  minimal,
  elegant,
  corporate,
];

export const DEFAULT_PRESET_SLUG = modernDark.slug;

export function findPreset(slug: string | null | undefined): ThemePreset | undefined {
  if (!slug) return undefined;
  return THEME_PRESETS.find((preset) => preset.slug === slug);
}

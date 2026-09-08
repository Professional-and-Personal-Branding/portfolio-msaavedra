import {
  DEFAULT_TOKENS,
  mergeTokens,
  parseThemeTokens,
  type PartialThemeTokens,
  type ThemeTokens,
} from '@/themes/tokens';
import type { AdminTheme } from '../shared/admin-types';

const GROUPS = ['colors', 'typography', 'layout', 'effects'] as const;
type Group = (typeof GROUPS)[number];

/** Tokens del tema base elegido; sin tema, el preset por defecto. */
export function baseTokensOf(theme: AdminTheme | undefined): ThemeTokens {
  return theme ? parseThemeTokens(theme.tokens) : DEFAULT_TOKENS;
}

/** Tokens efectivos que ve el preview: tema base + overrides del perfil. */
export function effectiveTokens(base: ThemeTokens, overrides: unknown): ThemeTokens {
  if (overrides === null || overrides === undefined) return base;
  return parseThemeTokens(overrides, base);
}

/**
 * Diferencias mínimas entre el tema base y el estado actual: es lo único que
 * se guarda como `themeOverrides` (spec `theme-customizer`). Si no hay
 * diferencias devuelve `null`, que la API interpreta como "sin overrides".
 */
export function diffTokens(base: ThemeTokens, current: ThemeTokens): PartialThemeTokens | null {
  const diff: Record<string, unknown> = {};
  if (current.mode !== base.mode) diff.mode = current.mode;

  for (const group of GROUPS) {
    const changed = diffGroup(base[group], current[group]);
    if (Object.keys(changed).length > 0) diff[group] = changed;
  }
  return Object.keys(diff).length > 0 ? (diff as PartialThemeTokens) : null;
}

function diffGroup(base: ThemeTokens[Group], current: ThemeTokens[Group]): Record<string, unknown> {
  const changed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(current)) {
    if ((base as Record<string, unknown>)[key] !== value) changed[key] = value;
  }
  return changed;
}

/** Aplica un cambio puntual sobre los tokens efectivos. */
export function setToken(
  tokens: ThemeTokens,
  group: Group | 'mode',
  key: string,
  value: string | boolean,
): ThemeTokens {
  if (group === 'mode') return mergeTokens(tokens, { mode: value as ThemeTokens['mode'] });
  return mergeTokens(tokens, { [group]: { [key]: value } } as PartialThemeTokens);
}

export const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: string): boolean {
  return HEX_PATTERN.test(value.trim());
}

import { ThemeTokens } from '../entities/theme.entity';

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Merge profundo de `themeOverrides` sobre los tokens base (spec `theme-resolution`):
 * - objetos planos se fusionan recursivamente;
 * - primitivos y arrays del override reemplazan al base;
 * - claves ausentes, `null` o `undefined` en el override conservan el base;
 * - un override que no sea objeto se ignora.
 * Nunca muta sus argumentos ni lanza.
 */
export function mergeThemeTokens(base: ThemeTokens, overrides: unknown): ThemeTokens {
  const result: ThemeTokens = structuredClone(base);
  if (!isPlainObject(overrides)) return result;

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === null) continue;
    const current = result[key];
    if (isPlainObject(value) && isPlainObject(current)) {
      result[key] = mergeThemeTokens(current, value);
    } else {
      result[key] = structuredClone(value);
    }
  }
  return result;
}

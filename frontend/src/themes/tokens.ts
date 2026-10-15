import * as z from 'zod/mini';

/**
 * Contrato de design tokens compartido con `Theme.tokens` del backend
 * (spec `runtime-theming`). Todo campo es opcional en la entrada porque los
 * temas de perfil pueden ser parciales; `mergeTokens` los completa con el
 * preset `modern-dark`.
 *
 * Valida con `zod/mini`, la API funcional de Zod 4: el arranque público no carga la API
 * clásica (≈ 80 KB min) y los formularios del panel siguen con `zod`, en su chunk diferido
 * (spec `web-performance` § Presupuesto de JS del arranque público).
 */
export const themeModeSchema = z.enum(['light', 'dark']);
export const densitySchema = z.enum(['compact', 'comfortable', 'spacious']);
export const typeScaleSchema = z.enum(['compact', 'default', 'large']);

const colorsSchema = z.object({
  bg: z.string(),
  bgSoft: z.string(),
  card: z.string(),
  border: z.string(),
  text: z.string(),
  textMuted: z.string(),
  accent: z.string(),
  accent2: z.string(),
});

const typographySchema = z.object({
  fontSans: z.string(),
  fontHeading: z.string(),
  scale: typeScaleSchema,
});

const layoutSchema = z.object({
  radius: z.string(),
  maxWidth: z.string(),
  density: densitySchema,
});

const effectsSchema = z.object({
  animations: z.boolean(),
  glassmorphism: z.boolean(),
});

export const themeTokensSchema = z.object({
  mode: themeModeSchema,
  colors: colorsSchema,
  typography: typographySchema,
  layout: layoutSchema,
  effects: effectsSchema,
});

/** Entrada parcial (tal como puede venir de la API o de un override). */
export const partialThemeTokensSchema = z.object({
  mode: z.optional(themeModeSchema),
  colors: z.optional(z.partial(colorsSchema)),
  typography: z.optional(z.partial(typographySchema)),
  layout: z.optional(z.partial(layoutSchema)),
  effects: z.optional(z.partial(effectsSchema)),
});

export type ThemeTokens = z.infer<typeof themeTokensSchema>;
export type PartialThemeTokens = z.infer<typeof partialThemeTokensSchema>;
export type ThemeMode = z.infer<typeof themeModeSchema>;
export type Density = z.infer<typeof densitySchema>;

/** Preset `modern-dark` del seed: base de todo tema (spec `runtime-theming`). */
export const DEFAULT_TOKENS: ThemeTokens = {
  mode: 'dark',
  colors: {
    bg: '#0a0e1a',
    bgSoft: '#111827',
    card: '#161d2e',
    border: '#252d42',
    text: '#e8edf5',
    textMuted: '#94a3b8',
    accent: '#38bdf8',
    accent2: '#818cf8',
  },
  typography: { fontSans: 'Inter', fontHeading: 'Inter', scale: 'default' },
  layout: { radius: '16px', maxWidth: '1080px', density: 'comfortable' },
  effects: { animations: true, glassmorphism: true },
};

/**
 * Merge profundo de un nivel por grupo (`colors`, `typography`, …): los
 * valores definidos en `override` reemplazan a los de `base`; `undefined`
 * no pisa nada. Espejo de `mergeThemeTokens` del backend.
 */
export function mergeTokens(
  base: ThemeTokens,
  override: PartialThemeTokens | null | undefined,
): ThemeTokens {
  if (!override) return base;
  return {
    mode: override.mode ?? base.mode,
    colors: { ...base.colors, ...compact(override.colors) },
    typography: { ...base.typography, ...compact(override.typography) },
    layout: { ...base.layout, ...compact(override.layout) },
    effects: { ...base.effects, ...compact(override.effects) },
  };
}

/**
 * Convierte el `theme.tokens` (JSON sin tipar) de la API en tokens completos.
 * Un valor inválido se descarta con advertencia y se usa el default: un tema
 * mal guardado nunca rompe la vista pública.
 */
export function parseThemeTokens(input: unknown, base: ThemeTokens = DEFAULT_TOKENS): ThemeTokens {
  const result = partialThemeTokensSchema.safeParse(input ?? {});
  if (!result.success) {
    console.warn('[theme] tokens inválidos; se aplica el preset por defecto', result.error.issues);
    return base;
  }
  return mergeTokens(base, result.data);
}

function compact<T extends object>(value: T | undefined): Partial<T> {
  if (!value) return {};
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

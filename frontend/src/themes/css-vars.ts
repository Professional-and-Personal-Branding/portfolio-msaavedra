import { accentInk, mix, parseHex, readableOn, textDim, toHex } from './contrast';
import type { Density, ThemeTokens } from './tokens';

export { readableOn };

/** Factor de espaciado por densidad (spec `runtime-theming` § Densidad). */
export const DENSITY_SCALE: Record<Density, number> = {
  compact: 0.75,
  comfortable: 1,
  spacious: 1.25,
};

const TYPE_SCALE: Record<ThemeTokens['typography']['scale'], number> = {
  compact: 0.94,
  default: 1,
  large: 1.08,
};

const SYSTEM_SANS =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const SYSTEM_SERIF = 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';
const SERIF_FAMILIES = new Set([
  'georgia',
  'merriweather',
  'playfair display',
  'lora',
  'times new roman',
]);

/** Verde base de los estados positivos («Actual»); el derivado legible sale de `--t-success-ink`. */
export const SUCCESS = '#00bc7d';

export interface ThemeCssVars {
  '--t-bg': string;
  '--t-bg-soft': string;
  '--t-card': string;
  '--t-border': string;
  '--t-text': string;
  '--t-text-muted': string;
  '--t-accent': string;
  '--t-accent2': string;
  '--t-accent-foreground': string;
  /** Acento legible como texto (≥ 4,5:1): derivado, no se guarda (spec `web-accessibility`). */
  '--t-accent-ink': string;
  /** Verde de estado como texto (≥ 4,5:1): derivado como el acento, no se guarda. */
  '--t-success-ink': string;
  /** El segundo acento como texto (títulos de categoría de skills), con el mismo criterio. */
  '--t-accent2-ink': string;
  /** Texto atenuado con contraste AA garantizado. */
  '--t-text-dim': string;
  /** Color del indicador de foco. */
  '--t-ring': string;
  '--t-radius': string;
  '--t-max-width': string;
  '--t-space': string;
  '--t-density': string;
  '--t-scale': string;
  '--t-font-sans': string;
  '--t-font-heading': string;
  '--t-glass': string;
  '--t-motion': string;
}

/** Convierte tokens en el mapa `--t-*` que aplica el `ThemeProvider`. */
export function tokensToCssVars(tokens: ThemeTokens): ThemeCssVars {
  const { colors, typography, layout, effects } = tokens;
  const density = DENSITY_SCALE[layout.density];
  const ink = accentInk(colors.accent, inkSurfaces(tokens), tokens.mode);
  return {
    '--t-bg': colors.bg,
    '--t-bg-soft': colors.bgSoft,
    '--t-card': colors.card,
    '--t-border': colors.border,
    '--t-text': colors.text,
    '--t-text-muted': colors.textMuted,
    '--t-accent': colors.accent,
    '--t-accent2': colors.accent2,
    '--t-accent-foreground': readableOn(colors.accent),
    '--t-accent-ink': ink,
    '--t-success-ink': accentInk(SUCCESS, inkSurfaces(tokens, SUCCESS, 0.15), tokens.mode),
    '--t-accent2-ink': accentInk(
      colors.accent2,
      [colors.bg, colors.bgSoft, colors.card],
      tokens.mode,
    ),
    '--t-text-dim': textDim(colors.textMuted, colors.bg, [colors.bg, colors.bgSoft, colors.card]),
    '--t-ring': ink,
    '--t-radius': layout.radius,
    '--t-max-width': layout.maxWidth,
    '--t-space': `${density}rem`,
    '--t-density': String(density),
    '--t-scale': String(TYPE_SCALE[typography.scale]),
    '--t-font-sans': fontStack(typography.fontSans),
    '--t-font-heading': fontStack(typography.fontHeading),
    '--t-glass': effects.glassmorphism ? '1' : '0',
    '--t-motion': effects.animations ? '1' : '0',
  };
}

/**
 * Superficies sobre las que un color tiene que leerse como texto: los tres fondos del tema y el
 * tinte de su insignia sobre el fondo y sobre la tarjeta. El acento usa `bg-brand/10`; el verde
 * de estado, `bg-success/15` (`amount` es la fracción del color en la mezcla).
 */
function inkSurfaces(
  { colors }: ThemeTokens,
  tint: string = colors.accent,
  amount = 0.1,
): string[] {
  const surfaces = [colors.bg, colors.bgSoft, colors.card];
  const color = parseHex(tint);
  if (!color) return surfaces;
  for (const base of [colors.bg, colors.card]) {
    const rgb = parseHex(base);
    if (rgb) surfaces.push(toHex(mix(rgb, color, amount)));
  }
  return surfaces;
}

/** Familia elegida + fallback del sistema (Google Fonts puede no cargar). */
export function fontStack(family: string): string {
  const trimmed = family.trim();
  const quoted = /\s/.test(trimmed) ? `"${trimmed}"` : trimmed;
  const fallback = SERIF_FAMILIES.has(trimmed.toLowerCase()) ? SYSTEM_SERIF : SYSTEM_SANS;
  return `${quoted}, ${fallback}`;
}

import type { Density, ThemeTokens } from './tokens';

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

/** Familia elegida + fallback del sistema (Google Fonts puede no cargar). */
export function fontStack(family: string): string {
  const trimmed = family.trim();
  const quoted = /\s/.test(trimmed) ? `"${trimmed}"` : trimmed;
  const fallback = SERIF_FAMILIES.has(trimmed.toLowerCase()) ? SYSTEM_SERIF : SYSTEM_SANS;
  return `${quoted}, ${fallback}`;
}

/** Texto negro o blanco según el brillo percibido (YIQ) del color, para botones sobre el acento. */
export function readableOn(hexColor: string): string {
  const rgb = parseHex(hexColor);
  if (!rgb) return '#ffffff';
  const [r, g, b] = rgb;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness >= 128 ? '#0a0e1a' : '#ffffff';
}

function parseHex(value: string): [number, number, number] | null {
  const match = /^#?([a-f\d]{3}|[a-f\d]{6})$/i.exec(value.trim());
  if (!match?.[1]) return null;
  const hex = match[1].length === 3 ? [...match[1]].map((c) => c + c).join('') : match[1];
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

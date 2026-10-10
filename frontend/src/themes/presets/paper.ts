import type { ThemeTokens } from '../tokens';

/**
 * Paleta de papel de la hoja imprimible (decisión D6 de `add-printable-one-page`):
 * tinta oscura sobre blanco, con contraste ≥ 4,5:1, sea cual sea el tema de la pantalla.
 * Vive en `presets/` para respetar que los colores literales no salen de esta carpeta, pero
 * NO es un preset: no figura en `THEME_PRESETS` ni lo resuelve `findPreset`.
 * El acento y la tipografía no se fijan acá: la hoja los hereda del perfil.
 */
export const PAPER_COLORS: Pick<
  ThemeTokens['colors'],
  'bg' | 'bgSoft' | 'card' | 'border' | 'text' | 'textMuted'
> = {
  bg: '#ffffff',
  bgSoft: '#ffffff',
  card: '#ffffff',
  border: '#bbbbbb',
  text: '#111111',
  textMuted: '#444444',
};

/** Tokens de la hoja: los activos del perfil con los colores de papel encima. */
export function paperTokens(active: ThemeTokens): ThemeTokens {
  return {
    ...active,
    mode: 'light',
    colors: { ...active.colors, ...PAPER_COLORS },
  };
}

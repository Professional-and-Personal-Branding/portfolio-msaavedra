import { describe, expect, it } from 'vitest';
import { DEFAULT_PRESET_SLUG, findPreset, THEME_PRESETS } from './index';
import { themeTokensSchema } from '../tokens';
import { PAPER_COLORS, paperTokens } from './paper';

describe('THEME_PRESETS', () => {
  it('incluye los cinco presets del seed', () => {
    expect(THEME_PRESETS.map((p) => p.slug)).toEqual([
      'modern-dark',
      'modern-light',
      'minimal',
      'elegant',
      'corporate',
    ]);
    expect(DEFAULT_PRESET_SLUG).toBe('modern-dark');
  });

  it('cada preset tiene tokens completos y válidos', () => {
    for (const preset of THEME_PRESETS) {
      expect(themeTokensSchema.safeParse(preset.tokens).success, preset.slug).toBe(true);
    }
  });

  it('los cinco producen bg y accent distintos entre sí', () => {
    const bgs = new Set(THEME_PRESETS.map((p) => p.tokens.colors.bg));
    const accents = new Set(THEME_PRESETS.map((p) => p.tokens.colors.accent));
    expect(bgs.size).toBe(5);
    expect(accents.size).toBe(5);
  });

  it('findPreset resuelve por slug y devuelve undefined si no existe', () => {
    expect(findPreset('elegant')?.name).toBe('Elegant');
    expect(findPreset('neon')).toBeUndefined();
    expect(findPreset(null)).toBeUndefined();
  });

  it('la paleta de papel no es un preset conmutable', () => {
    expect(THEME_PRESETS).toHaveLength(5);
    expect(findPreset('paper')).toBeUndefined();
  });

  it('paperTokens pone tinta sobre blanco y conserva acento y tipografía del perfil', () => {
    const base = THEME_PRESETS[0]!.tokens;
    const paper = paperTokens(base);
    expect(paper.colors.bg).toBe(PAPER_COLORS.bg);
    expect(paper.colors.text).toBe('#111111');
    expect(paper.mode).toBe('light');
    expect(paper.colors.accent).toBe(base.colors.accent);
    expect(paper.typography).toEqual(base.typography);
    expect(themeTokensSchema.safeParse(paper).success).toBe(true);
  });
});

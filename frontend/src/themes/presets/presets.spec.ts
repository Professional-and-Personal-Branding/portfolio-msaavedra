import { describe, expect, it } from 'vitest';
import { DEFAULT_PRESET_SLUG, findPreset, THEME_PRESETS } from './index';
import { themeTokensSchema } from '../tokens';

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
});

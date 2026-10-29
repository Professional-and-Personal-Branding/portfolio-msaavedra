import { describe, expect, it } from 'vitest';
import { AA_TEXT, contrastRatio, mix, parseHex, toHex } from './contrast';
import { fontStack, readableOn, SUCCESS, tokensToCssVars } from './css-vars';
import { THEME_PRESETS } from './presets';
import { DEFAULT_TOKENS, mergeTokens } from './tokens';

describe('tokensToCssVars', () => {
  it('mapea todos los tokens a variables --t-*', () => {
    const vars = tokensToCssVars(DEFAULT_TOKENS);

    expect(vars['--t-bg']).toBe('#0a0e1a');
    expect(vars['--t-bg-soft']).toBe('#111827');
    expect(vars['--t-card']).toBe('#161d2e');
    expect(vars['--t-border']).toBe('#252d42');
    expect(vars['--t-text']).toBe('#e8edf5');
    expect(vars['--t-text-muted']).toBe('#94a3b8');
    expect(vars['--t-accent']).toBe('#38bdf8');
    expect(vars['--t-accent2']).toBe('#818cf8');
    expect(vars['--t-radius']).toBe('16px');
    expect(vars['--t-max-width']).toBe('1080px');
    expect(vars['--t-font-sans']).toMatch(/^Inter, /);
    expect(vars['--t-font-heading']).toMatch(/^Inter, /);
    expect(vars['--t-motion']).toBe('1');
    expect(vars['--t-glass']).toBe('1');
    expect(Object.keys(vars).every((key) => key.startsWith('--t-'))).toBe(true);
  });

  it('la densidad escala el espaciado base', () => {
    const compact = tokensToCssVars(
      mergeTokens(DEFAULT_TOKENS, { layout: { density: 'compact' } }),
    );
    const comfortable = tokensToCssVars(DEFAULT_TOKENS);
    const spacious = tokensToCssVars(
      mergeTokens(DEFAULT_TOKENS, { layout: { density: 'spacious' } }),
    );

    expect(parseFloat(compact['--t-space'])).toBeLessThan(parseFloat(comfortable['--t-space']));
    expect(parseFloat(spacious['--t-space'])).toBeGreaterThan(parseFloat(comfortable['--t-space']));
  });

  it('animations=false apaga la variable de movimiento', () => {
    const vars = tokensToCssVars(mergeTokens(DEFAULT_TOKENS, { effects: { animations: false } }));
    expect(vars['--t-motion']).toBe('0');
  });
});

describe('fontStack', () => {
  it('agrega fallback sans o serif según la familia', () => {
    expect(fontStack('Inter')).toMatch(/^Inter, ui-sans-serif/);
    expect(fontStack('Georgia')).toMatch(/^Georgia, ui-serif/);
    expect(fontStack('Playfair Display')).toMatch(/^"Playfair Display", ui-serif/);
  });
});

describe('readableOn', () => {
  it('elige texto oscuro sobre acentos claros y claro sobre oscuros', () => {
    expect(readableOn('#38bdf8')).toBe('#0a0e1a');
    expect(readableOn('#c8a04e')).toBe('#0a0e1a');
    expect(readableOn('#1d4ed8')).toBe('#ffffff');
    expect(readableOn('#18181b')).toBe('#ffffff');
    expect(readableOn('no-es-color')).toBe('#ffffff');
  });
});

describe('--t-success-ink (fix-admin-contrast, D2)', () => {
  const tintOn = (base: string) => toHex(mix(parseHex(base)!, parseHex(SUCCESS)!, 0.15));

  for (const preset of THEME_PRESETS) {
    it(`${preset.slug}: mide >= 4,5:1 contra los tres fondos y los dos tintes de la insignia`, () => {
      const { colors } = preset.tokens;
      const ink = tokensToCssVars(preset.tokens)['--t-success-ink'];
      for (const surface of [
        colors.bg,
        colors.bgSoft,
        colors.card,
        tintOn(colors.bg),
        tintOn(colors.card),
      ]) {
        expect(contrastRatio(ink, surface)).toBeGreaterThanOrEqual(AA_TEXT);
      }
    });
  }

  it('en los presets oscuros es el verde base; en los claros, un verde más oscuro del mismo tono', () => {
    const inkOf = (slug: string) =>
      tokensToCssVars(THEME_PRESETS.find((p) => p.slug === slug)!.tokens)['--t-success-ink'];
    expect(inkOf('modern-dark')).toBe('#00bc7d');
    expect(inkOf('elegant')).toBe('#00bc7d');
    expect(inkOf('modern-light')).toBe('#00754e');
    expect(inkOf('minimal')).toBe('#007a51');
    expect(inkOf('corporate')).toBe('#00754e');
  });

  it('responde a los overrides: con una tarjeta más oscura sobre modern-light se recalcula y cumple', () => {
    const light = THEME_PRESETS.find((p) => p.slug === 'modern-light')!.tokens;
    const tokens = mergeTokens(light, { colors: { card: '#94a3b8' } });
    const ink = tokensToCssVars(tokens)['--t-success-ink'];
    expect(ink).not.toBe(tokensToCssVars(light)['--t-success-ink']);
    for (const surface of [tokens.colors.bg, tokens.colors.bgSoft, tokens.colors.card]) {
      expect(contrastRatio(ink, surface)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });
});

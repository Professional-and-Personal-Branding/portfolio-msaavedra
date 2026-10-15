import { describe, expect, it } from 'vitest';
import { AA_TEXT, accentInk, contrastRatio, parseHex, textDim } from './contrast';
import { tokensToCssVars } from './css-vars';
import { THEME_PRESETS } from './presets';
import { DEFAULT_TOKENS, mergeTokens } from './tokens';

/** Acentos de los perfiles del owner (`audit/contrast-tokens.md`), todos sobre `modern-dark`. */
const PROFILE_ACCENTS: Record<string, string> = {
  'ai-software-engineer': '#6D28D9',
  all: '#38bdf8',
  'backend-payments-ror': '#9B1C2E',
  'devops-azure': '#0078D4',
  'devops-platform': '#0F766E',
  'dotnet-backend': '#0078D4',
  'fullstack-microsoft': '#0078D4',
  'fullstack-nest-react': '#065F46',
  'generalist-polyglot': '#0F766E',
  'integration-architect': '#0E5263',
  'it-leadership': '#1B3A6B',
  'java-senior-backend': '#1A365D',
  'software-architect': '#1E293B',
  'tech-lead-dotnet': '#5B2C87',
};

/** Superficies donde cae el texto: fondos del tema. */
function surfacesOf(tokens: { colors: { bg: string; bgSoft: string; card: string } }) {
  return [tokens.colors.bg, tokens.colors.bgSoft, tokens.colors.card];
}

describe('contrastRatio', () => {
  it('coincide con los valores de referencia de WCAG', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    // Valores medidos en `audit/contrast-tokens.md`.
    expect(contrastRatio('#5B2C87', '#0a0e1a')).toBeCloseTo(1.98, 1);
    expect(contrastRatio('#0284c7', '#ffffff')).toBeCloseTo(4.09, 1);
    expect(contrastRatio('#0284c7', '#0a0e1a')).toBeCloseTo(4.7, 1);
  });

  it('devuelve NaN con un color ilegible', () => {
    expect(contrastRatio('rojo', '#fff')).toBeNaN();
  });
});

describe('accentInk', () => {
  it('conserva el acento cuando ya llega a 4,5:1', () => {
    expect(accentInk('#38bdf8', surfacesOf(DEFAULT_TOKENS), 'dark')).toBe('#38bdf8');
  });

  it('aclara en tema oscuro y oscurece en tema claro, manteniendo el tono', () => {
    const dark = surfacesOf(DEFAULT_TOKENS);
    const light = ['#ffffff', '#f4f6fa', '#ffffff'];
    const onDark = accentInk('#5B2C87', dark, 'dark');
    const onLight = accentInk('#0284c7', light, 'light');

    const [h0] = hueOf('#5B2C87');
    const [h1] = hueOf(onDark);
    expect(Math.abs(h0 - h1)).toBeLessThan(4);
    expect(luminanceOf(onDark)).toBeGreaterThan(luminanceOf('#5B2C87'));
    expect(luminanceOf(onLight)).toBeLessThan(luminanceOf('#0284c7'));
    for (const s of dark) expect(contrastRatio(onDark, s)).toBeGreaterThanOrEqual(AA_TEXT);
    for (const s of light) expect(contrastRatio(onLight, s)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('un color ilegible se devuelve tal cual', () => {
    expect(accentInk('no-es-color', ['#000'], 'dark')).toBe('no-es-color');
  });

  it('sin solución exacta devuelve el mejor extremo (gris medio)', () => {
    const ink = accentInk('#808080', ['#808080'], 'dark');
    expect(contrastRatio(ink, '#808080')).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe('textDim', () => {
  it('queda más tenue que textMuted y cumple 4,5:1 cuando se puede', () => {
    const tokens = DEFAULT_TOKENS;
    const dim = textDim(tokens.colors.textMuted, tokens.colors.bg, surfacesOf(tokens));
    expect(dim).not.toBe(tokens.colors.textMuted);
    for (const s of surfacesOf(tokens)) {
      expect(contrastRatio(dim, s)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('cae a textMuted si ni la mezcla mínima llega', () => {
    expect(textDim('#777777', '#777777', ['#777777'])).toBe('#777777');
  });
});

describe('derivados de los tokens: contraste AA por construcción', () => {
  for (const preset of THEME_PRESETS) {
    it(`preset ${preset.slug}: ink, dim y botón ≥ 4,5:1`, () => {
      const vars = tokensToCssVars(preset.tokens);
      for (const surface of surfacesOf(preset.tokens)) {
        expect(contrastRatio(vars['--t-accent-ink'], surface)).toBeGreaterThanOrEqual(AA_TEXT);
        expect(contrastRatio(vars['--t-text-dim'], surface)).toBeGreaterThanOrEqual(AA_TEXT);
        expect(contrastRatio(vars['--t-accent2-ink'], surface)).toBeGreaterThanOrEqual(AA_TEXT);
        // El foco necesita 3:1; el derivado da holgura.
        expect(contrastRatio(vars['--t-ring'], surface)).toBeGreaterThanOrEqual(3);
      }
      expect(
        contrastRatio(vars['--t-accent-foreground'], preset.tokens.colors.accent),
      ).toBeGreaterThanOrEqual(AA_TEXT);
    });
  }

  for (const [slug, accent] of Object.entries(PROFILE_ACCENTS)) {
    it(`perfil ${slug} (${accent}) sobre modern-dark`, () => {
      const tokens = mergeTokens(DEFAULT_TOKENS, { colors: { accent } });
      const vars = tokensToCssVars(tokens);
      for (const surface of surfacesOf(tokens)) {
        expect(contrastRatio(vars['--t-accent-ink'], surface)).toBeGreaterThanOrEqual(AA_TEXT);
        expect(contrastRatio(vars['--t-text-dim'], surface)).toBeGreaterThanOrEqual(AA_TEXT);
      }
      // El rellenos sigue siendo el acento guardado: solo cambia el derivado.
      expect(vars['--t-accent']).toBe(accent);
      expect(contrastRatio(vars['--t-accent-foreground'], accent)).toBeGreaterThanOrEqual(AA_TEXT);
    });
  }

  it('el acento por defecto (#38bdf8) no cambia', () => {
    expect(tokensToCssVars(DEFAULT_TOKENS)['--t-accent-ink']).toBe('#38bdf8');
  });

  it('modern-light: el botón pasa a texto oscuro (4,70:1) y el ink se oscurece', () => {
    const light = THEME_PRESETS.find((p) => p.slug === 'modern-light');
    expect(light).toBeDefined();
    const vars = tokensToCssVars(light!.tokens);
    expect(vars['--t-accent-foreground']).toBe('#0a0e1a');
    expect(vars['--t-accent-ink']).not.toBe(light!.tokens.colors.accent);
  });
});

/** Orden por luminosidad: el contraste contra negro crece con la luminancia. */
function luminanceOf(hex: string): number {
  return contrastRatio(hex, '#000000');
}

function hueOf(hex: string): [number] {
  const rgb = parseHex(hex);
  if (!rgb) throw new Error(hex);
  const [r, g, b] = rgb.map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return [0];
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [(h * 60 + 360) % 360];
}

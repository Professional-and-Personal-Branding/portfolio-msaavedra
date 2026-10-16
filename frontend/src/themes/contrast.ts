/**
 * Aritmética de color y contraste WCAG 2.x para derivar, desde los tokens, los colores que
 * tienen que ser legibles (spec `web-accessibility`, decisiones D1–D3). Funciones puras: no
 * tocan el DOM y son las mismas en el cliente y en los tests.
 */

export type Rgb = [number, number, number];

/** Umbral AA de WCAG para texto normal. */
export const AA_TEXT = 4.5;

const LIGHT_TEXT = '#ffffff';
const DARK_TEXT = '#0a0e1a';

/** Acepta `#rgb` y `#rrggbb` (con o sin `#`); cualquier otra cosa devuelve `null`. */
export function parseHex(value: string): Rgb | null {
  const match = /^#?([a-f\d]{3}|[a-f\d]{6})$/i.exec(value.trim());
  if (!match?.[1]) return null;
  const hex = match[1].length === 3 ? [...match[1]].map((c) => c + c).join('') : match[1];
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

export function toHex([r, g, b]: Rgb): string {
  const part = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Luminancia relativa (WCAG 2.x). */
export function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Razón de contraste WCAG entre dos colores RGB. */
export function contrastRgb(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Razón de contraste entre dos colores hex; `NaN` si alguno no se puede leer. */
export function contrastRatio(a: string, b: string): number {
  const ra = parseHex(a);
  const rb = parseHex(b);
  return ra && rb ? contrastRgb(ra, rb) : Number.NaN;
}

/** Mezcla lineal en sRGB, igual que `color-mix(in srgb, a (1-t), b t)` con colores opacos. */
export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Redondea a 8 bits por canal: el contraste se mide sobre el color que realmente se pinta. */
function quantize(color: Rgb): Rgb {
  return color.map((v) => Math.round(Math.min(255, Math.max(0, v)))) as Rgb;
}

function minContrast(color: Rgb, surfaces: readonly Rgb[]): number {
  const painted = quantize(color);
  return Math.min(...surfaces.map((surface) => contrastRgb(painted, surface)));
}

function toHsl([r, g, b]: Rgb): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function fromHsl(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/**
 * Acento legible como texto (D1): si `accent` ya llega a 4,5:1 contra todas las superficies,
 * es el propio acento; si no, mismo tono y saturación con la luminosidad movida —hacia claro
 * en tema oscuro, hacia oscuro en tema claro— en el menor paso (1 %) que cumple. Si en ese
 * sentido no hay solución prueba el otro, y si ninguno alcanza devuelve el mejor extremo.
 */
export function accentInk(
  accent: string,
  surfaces: readonly string[],
  mode: 'light' | 'dark',
): string {
  const base = parseHex(accent);
  const bases = surfaces.map(parseHex);
  if (!base || bases.some((s) => s === null)) return accent;
  const rgbSurfaces = bases as Rgb[];
  if (minContrast(base, rgbSurfaces) >= AA_TEXT) return accent;

  const [h, s, l0] = toHsl(base);
  const directions = mode === 'dark' ? [1, -1] : [-1, 1];
  let best: { color: Rgb; ratio: number } = { color: base, ratio: minContrast(base, rgbSurfaces) };
  for (const direction of directions) {
    for (let step = 1; step <= 100; step++) {
      const l = l0 + (direction * step) / 100;
      if (l < 0 || l > 1) break;
      const candidate = fromHsl(h, s, l);
      const ratio = minContrast(candidate, rgbSurfaces);
      if (ratio >= AA_TEXT) return toHex(candidate);
      if (ratio > best.ratio) best = { color: candidate, ratio };
    }
  }
  return toHex(best.color);
}

/**
 * Texto atenuado (D3): la mezcla de `textMuted` hacia `bg` más cercana al 70 % histórico
 * (30 % de `bg`) que todavía llega a 4,5:1 contra todas las superficies; si ninguna llega,
 * `textMuted`. Conserva la jerarquía: nunca es más tenue de lo que el contraste permite.
 */
export function textDim(textMuted: string, bg: string, surfaces: readonly string[]): string {
  const muted = parseHex(textMuted);
  const background = parseHex(bg);
  const bases = surfaces.map(parseHex);
  if (!muted || !background || bases.some((s) => s === null)) return textMuted;
  const rgbSurfaces = bases as Rgb[];
  for (let percent = 30; percent > 0; percent--) {
    const candidate = mix(muted, background, percent / 100);
    if (minContrast(candidate, rgbSurfaces) >= AA_TEXT) return toHex(candidate);
  }
  return textMuted;
}

/**
 * Texto sobre un relleno de acento (D2): entre blanco y `#0a0e1a`, el de mayor razón de
 * contraste WCAG con el acento. Un color ilegible cae a blanco.
 */
export function readableOn(hexColor: string): string {
  const accent = parseHex(hexColor);
  if (!accent) return LIGHT_TEXT;
  const light = contrastRgb(accent, parseHex(LIGHT_TEXT) as Rgb);
  const dark = contrastRgb(accent, parseHex(DARK_TEXT) as Rgb);
  return dark > light ? DARK_TEXT : LIGHT_TEXT;
}

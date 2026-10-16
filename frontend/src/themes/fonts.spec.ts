import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FRONTEND_ROOT, readFrontendFile } from '@/test/source-files';
import { ensureFontLoaded } from './fonts';

afterEach(() => {
  document.head.querySelectorAll('link[data-font]').forEach((link) => link.remove());
});

describe('ensureFontLoaded', () => {
  it('Inter se sirve desde el propio origen: no inyecta la hoja de Google Fonts', () => {
    ensureFontLoaded('Inter');
    expect(document.head.querySelector('link[data-font="Inter"]')).toBeNull();
  });

  it('otra familia (Playfair Display) sí pide su hoja a Google Fonts, una sola vez', () => {
    ensureFontLoaded('Playfair Display');
    ensureFontLoaded('Playfair Display');

    const links = document.head.querySelectorAll('link[data-font="Playfair Display"]');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute(
      'href',
      expect.stringContaining('fonts.googleapis.com/css2?family=Playfair+Display'),
    );
  });
});

// D6 de `improve-mobile-performance`: `/fonts/*` se sirve como inmutable (Caddyfile).
describe('fuentes del propio origen', () => {
  const fontsDir = resolve(FRONTEND_ROOT, 'public/fonts');
  const woff2 = readdirSync(fontsDir).filter((name) => name.endsWith('.woff2'));

  it('hay al menos una y todas llevan la versión en el nombre (-v<n>)', () => {
    expect(woff2.length).toBeGreaterThan(0);
    for (const name of woff2) expect(name).toMatch(/-v\d+\.woff2$/);
  });

  it('cada fuente tiene su licencia junto al archivo', () => {
    expect(readdirSync(fontsDir)).toContain('OFL.txt');
  });

  it('theme.css e index.html apuntan al mismo archivo, y existe', () => {
    const css = readFrontendFile('src/themes/theme.css');
    const html = readFrontendFile('index.html');
    const fromCss = /url\(['"]?\/fonts\/([^'")]+\.woff2)['"]?\)/.exec(css)?.[1];
    const fromHtml = /<link[^>]*rel="preload"[^>]*href="\/fonts\/([^"]+\.woff2)"/s.exec(html)?.[1];

    expect(fromCss).toBeDefined();
    expect(fromHtml).toBe(fromCss);
    expect(woff2).toContain(fromCss);
  });

  it('el preload de la fuente es CORS (crossorigin) y de tipo woff2', () => {
    const html = readFrontendFile('index.html');
    const preload = /<link[^>]*as="font"[^>]*>/s.exec(html)?.[0] ?? '';
    expect(preload).toContain('type="font/woff2"');
    expect(preload).toContain('crossorigin');
  });

  it('index.html no menciona fonts.googleapis.com ni fonts.gstatic.com', () => {
    const html = readFrontendFile('index.html');
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
  });
});

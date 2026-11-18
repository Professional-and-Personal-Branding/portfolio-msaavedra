import { describe, expect, it } from 'vitest';
import { readFrontendFile } from '@/test/source-files';

// D5/D6 de `polish-pre-deploy-cleanup`: la regla de caché por defecto del sitio. Sin el prefijo `?`,
// Caddy agrega `no-cache` aunque la API ya mande su `Cache-Control` y la respuesta sale con dos
// líneas. Este test falla antes de que lo vea el paso de Docker del CI.
describe('Caddyfile: Cache-Control por defecto', () => {
  const lineas = readFrontendFile('Caddyfile')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'));

  it('la regla @noCache usa `?Cache-Control "no-cache"` (valor por defecto, no cabecera agregada)', () => {
    expect(lineas).toContain('header @noCache ?Cache-Control "no-cache"');
  });

  it('ninguna directiva `header @noCache Cache-Control` queda sin el prefijo', () => {
    expect(lineas.filter((l) => /^header @noCache\s+Cache-Control\b/.test(l))).toEqual([]);
  });

  it('los assets y las fuentes siguen siendo inmutables', () => {
    expect(lineas).toContain(
      'header /assets/* Cache-Control "public, max-age=31536000, immutable"',
    );
    expect(lineas).toContain('header /fonts/* Cache-Control "public, max-age=31536000, immutable"');
  });
});

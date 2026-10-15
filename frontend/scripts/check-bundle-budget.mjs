#!/usr/bin/env node
/**
 * Presupuesto de JS del arranque público (spec `web-performance` § Presupuesto de JS del
 * arranque público, decisión D8 de `improve-a11y-and-performance`).
 *
 *   npm run build && npm run perf:budget
 *   npm run perf:budget -- --out reports      # además escribe `bundle-budget.md`
 *
 * Mide sobre `dist/`, sin navegador ni base de datos: lee `dist/index.html`, toma el `<script
 * type="module">` de entrada y sus `<link rel="modulepreload">` (lo que se descarga antes de
 * pintar cualquier ruta pública) y suma el gzip de cada JS. Sale con código 1 si:
 *   - la suma supera BUDGET_KB (180 KB, 1 KB = 1000 bytes, como informa Vite), o
 *   - algún chunk del arranque contiene la API clásica de `zod` o las animaciones de `motion`
 *     (`whileInView` y los atributos `data-framer-*`), que tienen que cargarse en diferido.
 * Entorno: BUNDLE_BUDGET_KB sobreescribe el tope (solo para probar que el script detecta excesos).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const BUDGET_KB = Number(process.env.BUNDLE_BUDGET_KB ?? 180);

/**
 * Marcas que no pueden aparecer en el arranque. Son nombres de clase que sobreviven a la
 * minificación (van como cadena a `$constructor`) y propiedades que solo usa Motion.
 */
const FORBIDDEN = [
  { id: 'zod clásico (zod/v4/classic)', pattern: /[`"']Zod(Type|String|Object)[`"']/ },
  { id: 'animaciones de motion (whileInView)', pattern: /whileInView/ },
  { id: 'animaciones de motion (data-framer-*)', pattern: /data-framer-/ },
];

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('No existe dist/index.html: corré `npm run build` antes.');
  process.exit(2);
}

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const hrefs = [
  ...html.matchAll(/<script[^>]*type="module"[^>]*\ssrc="([^"]+)"/g),
  ...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*\shref="([^"]+)"/g),
].map((match) => match[1]);
const files = [...new Set(hrefs)].filter((href) => href.endsWith('.js'));
if (files.length === 0) {
  console.error('No encontré el script de entrada en dist/index.html.');
  process.exit(2);
}

const rows = files.map((href) => {
  const code = readFileSync(join(DIST, href.replace(/^\//, '')), 'utf8');
  return {
    href,
    gzip: gzipSync(code, { level: 9 }).length,
    forbidden: FORBIDDEN.filter(({ pattern }) => pattern.test(code)).map(({ id }) => id),
  };
});
const totalKb = rows.reduce((sum, row) => sum + row.gzip, 0) / 1000;

let report = `# Presupuesto de JS del arranque público\n\n| Chunk | gzip (KB) |\n|---|---|\n`;
for (const row of rows) report += `| ${row.href} | ${(row.gzip / 1000).toFixed(1)} |\n`;
report += `| **Total** | **${totalKb.toFixed(1)}** |\n\nPresupuesto: ${BUDGET_KB} KB.\n`;

const failures = [];
if (totalKb > BUDGET_KB) {
  failures.push(
    `El arranque pesa ${totalKb.toFixed(1)} KB gzip y el presupuesto es ${BUDGET_KB} KB.`,
  );
}
for (const row of rows) {
  for (const id of row.forbidden)
    failures.push(`${row.href} contiene ${id}; tiene que cargarse en diferido.`);
}
if (failures.length > 0) report += `\n## Fallas\n\n${failures.map((f) => `- ${f}`).join('\n')}\n`;

console.log(report);
const out = argValue('--out');
if (out) {
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'bundle-budget.md'), report);
}
process.exit(failures.length > 0 ? 1 : 0);

#!/usr/bin/env node
/**
 * Presupuesto de JS del arranque público (spec `web-performance` § Presupuesto de JS del
 * arranque público, decisión D9 de `improve-mobile-performance`).
 *
 *   npm run build && npm run perf:budget
 *   npm run perf:budget -- --out reports      # además escribe `bundle-budget.md`
 *
 * Mide sobre `dist/`, sin navegador ni base de datos: lee `dist/index.html` y toma **todos** los
 * scripts que carga antes de pintar cualquier ruta pública: el `<script type="module">` de
 * entrada, los `<link rel="modulepreload">` y los `<script src>` clásicos (como
 * `profile-prefetch.js`). Suma el gzip de cada JS. Sale con código 1 si:
 *   - la suma supera BUDGET_KB (155 KB, 1 KB = 1000 bytes, como informa Vite), o
 *   - hay más de un JS de módulo o algún `modulepreload` en el arranque (el arranque tiene que ser
 *     un solo archivo: partirlo, por ejemplo con `manualChunks`, cuesta una petición crítica por
 *     chunk), o
 *   - algún script del arranque contiene la API clásica de `zod`, las animaciones de `motion` para
 *     React (`whileInView`, `data-framer-*`) o el *popper* de Radix (lo traen los menús y los
 *     tooltips), que tienen que cargarse en diferido.
 * Entorno: BUNDLE_BUDGET_KB sobreescribe el tope (solo para probar que el script detecta excesos).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const BUDGET_KB = Number(process.env.BUNDLE_BUDGET_KB ?? 155);

/**
 * Marcas que no pueden aparecer en el arranque. Son nombres de clase que sobreviven a la
 * minificación (van como cadena a `$constructor`) y propiedades que solo usa Motion o Radix.
 */
const FORBIDDEN = [
  { id: 'zod clásico (zod/v4/classic)', pattern: /[`"']Zod(Type|String|Object)[`"']/ },
  { id: 'animaciones de motion (whileInView)', pattern: /whileInView/ },
  { id: 'animaciones de motion (data-framer-*)', pattern: /data-framer-/ },
  {
    id: 'popper de Radix (data-radix-popper-content-wrapper)',
    pattern: /data-radix-popper-content-wrapper/,
  },
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
const tags = (pattern) => [...html.matchAll(pattern)].map((match) => match[1]);

// Un `<script>` por etiqueta: el atributo `src` puede ir antes o después de `type`.
const scriptTags = [...html.matchAll(/<script\b[^>]*>/g)].map((match) => match[0]);
const srcOf = (tag) => /\ssrc="([^"]+)"/.exec(tag)?.[1];
const moduleScripts = scriptTags
  .filter((tag) => /\stype="module"/.test(tag))
  .map(srcOf)
  .filter(Boolean);
const classicScripts = scriptTags
  .filter((tag) => !/\stype="/.test(tag))
  .map(srcOf)
  .filter(Boolean);
const modulepreloads = tags(/<link[^>]*rel="modulepreload"[^>]*\shref="([^"]+)"/g);

const entries = [
  ...moduleScripts.map((href) => ({ href, kind: 'módulo' })),
  ...modulepreloads.map((href) => ({ href, kind: 'modulepreload' })),
  ...classicScripts.map((href) => ({ href, kind: 'clásico' })),
].filter(
  ({ href }, index, all) => href.endsWith('.js') && all.findIndex((e) => e.href === href) === index,
);

if (moduleScripts.length === 0) {
  console.error('No encontré el script de entrada en dist/index.html.');
  process.exit(2);
}

const rows = entries.map(({ href, kind }) => {
  const code = readFileSync(join(DIST, href.replace(/^\//, '')), 'utf8');
  return {
    href,
    kind,
    gzip: gzipSync(code, { level: 9 }).length,
    forbidden: FORBIDDEN.filter(({ pattern }) => pattern.test(code)).map(({ id }) => id),
  };
});
const totalKb = rows.reduce((sum, row) => sum + row.gzip, 0) / 1000;

let report = `# Presupuesto de JS del arranque público\n\n| Script | Tipo | gzip (KB) |\n|---|---|---|\n`;
for (const row of rows)
  report += `| ${row.href} | ${row.kind} | ${(row.gzip / 1000).toFixed(1)} |\n`;
report += `| **Total** | | **${totalKb.toFixed(1)}** |\n\nPresupuesto: ${BUDGET_KB} KB.\n`;

const failures = [];
if (totalKb > BUDGET_KB) {
  failures.push(
    `El arranque pesa ${totalKb.toFixed(1)} KB gzip y el presupuesto es ${BUDGET_KB} KB.`,
  );
}
const moduleFiles = rows.filter((row) => row.kind === 'módulo');
if (moduleFiles.length > 1) {
  failures.push(
    `El arranque carga ${moduleFiles.length} JS de módulo (${moduleFiles.map((row) => row.href).join(', ')}); tiene que ser uno solo.`,
  );
}
for (const href of modulepreloads) {
  failures.push(`${href} es un modulepreload del arranque; el arranque no precarga chunks.`);
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

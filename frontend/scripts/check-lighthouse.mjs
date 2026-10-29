#!/usr/bin/env node
/**
 * Umbral de Lighthouse verificable (spec `web-performance` § Umbral de Lighthouse verificable,
 * decisiones D10 y D11 de `improve-a11y-and-performance`).
 *
 *   A11Y_CHECK_DISPOSABLE_DB=1 npm run perf:check -- http://localhost:8080
 *   A11Y_CHECK_DISPOSABLE_DB=1 PERF_CHECK_RUNS=5 PERF_CHECK_MIN_PERFORMANCE=85 \
 *     npm run perf:check -- http://localhost:8080 --out reports
 *
 * Corre Lighthouse (versión fija, `npx -y`) en mobile sobre `/`, un perfil y su variante
 * `?lang=en&theme=modern-dark&layout=sidebar`, `PERF_CHECK_RUNS` veces cada una, y compara la
 * MEDIANA de cada categoría contra el umbral. `/admin/login` se mide una vez: solo Accessibility
 * y Best Practices bloquean (lleva `noindex` a propósito, así que su SEO se informa sin exigirse;
 * su Performance también es informativa).
 *
 * Entorno:
 *   A11Y_CHECK_DISPOSABLE_DB=1       OBLIGATORIA: cada corrida registra una visita en la base.
 *   PERF_CHECK_RUNS                  corridas por página pública (por defecto 3).
 *   PERF_CHECK_MIN_PERFORMANCE       umbral de la mediana de Performance (por defecto 90).
 *   PERF_CHECK_PROFILE               perfil a medir (por defecto `tech-lead-dotnet`).
 *   CHROME_PATH                      Chrome del sistema.
 *
 * Accessibility, Best Practices y SEO usan siempre 90. Sale con código 1 si alguna mediana
 * queda por debajo, 2 si falta A11Y_CHECK_DISPOSABLE_DB=1.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  chromeFlags,
  findChrome,
  LIGHTHOUSE_MOBILE_USER_AGENT,
  median,
  parseArgs,
  requireDisposableDb,
  writeReport,
} from './lib/web-quality.mjs';

requireDisposableDb('perf:check');

const LIGHTHOUSE = 'lighthouse@13.5.0';
const { base: BASE, out: OUT } = parseArgs();
const RUNS = Math.max(1, Number(process.env.PERF_CHECK_RUNS ?? 3));
const MIN_PERFORMANCE = Number(process.env.PERF_CHECK_MIN_PERFORMANCE ?? 90);
const MIN_OTHER = 90;
const PROFILE = process.env.PERF_CHECK_PROFILE ?? 'tech-lead-dotnet';
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];
const LABELS = {
  performance: 'Performance',
  accessibility: 'Accessibility',
  'best-practices': 'Best Practices',
  seo: 'SEO',
};

const chrome = findChrome();
process.env.CHROME_PATH = chrome;

/** `public`: las cuatro categorías bloquean. `login`: solo Accessibility y Best Practices. */
const PAGES = [
  { id: 'home', path: '/', kind: 'public', runs: RUNS },
  { id: 'profile', path: `/${PROFILE}`, kind: 'public', runs: RUNS },
  {
    id: 'profile-en-dark-sidebar',
    path: `/${PROFILE}?lang=en&theme=modern-dark&layout=sidebar`,
    kind: 'public',
    runs: RUNS,
  },
  { id: 'admin-login', path: '/admin/login', kind: 'login', runs: 1 },
];

const tmp = mkdtempSync(join(tmpdir(), 'perf-check-'));

function runLighthouse(page, run) {
  const name = `${page.id}.mobile-run${run}`;
  const target = join(tmp, name);
  const args = [
    '-y',
    LIGHTHOUSE,
    `${BASE}${page.path}`,
    '--quiet',
    '--output=json',
    '--output=html',
    `--output-path=${target}`,
    `--chrome-flags=${chromeFlags().join(' ')}`,
    // La visita queda como BOT y no suma en `views` (classify-profile-views, D10).
    `--emulated-user-agent=${LIGHTHOUSE_MOBILE_USER_AGENT}`,
    `--only-categories=${CATEGORIES.join(',')}`,
  ];
  // `shell: true` hace falta para `npx` en Windows; con shell, `&` de la URL y los espacios de las
  // rutas rompen el comando, así que cada argumento va entre comillas dobles (valen en cmd y en sh).
  const command = ['npx', ...args.map((arg) => `"${arg}"`)].join(' ');
  const result = spawnSync(command, { stdio: ['ignore', 'inherit', 'inherit'], shell: true });
  if (result.status !== 0)
    throw new Error(`Lighthouse falló en ${name} (código ${result.status}).`);
  const json = readFileSync(`${target}.report.json`, 'utf8');
  return { name, json: JSON.parse(json), html: readFileSync(`${target}.report.html`, 'utf8') };
}

function summarize(report) {
  const score = (key) => Math.round((report.categories[key]?.score ?? 0) * 100);
  const audit = (id) => report.audits[id]?.numericValue ?? 0;
  const items = report.audits['resource-summary']?.details?.items ?? [];
  const scriptKb = (items.find((i) => i.resourceType === 'script')?.transferSize ?? 0) / 1024;
  return {
    scores: Object.fromEntries(CATEGORIES.map((c) => [c, score(c)])),
    lcp: audit('largest-contentful-paint'),
    fcp: audit('first-contentful-paint'),
    tbt: audit('total-blocking-time'),
    cls: audit('cumulative-layout-shift'),
    scriptKb,
  };
}

const rows = [];
const failures = [];
const reportFiles = [];

for (const page of PAGES) {
  const runs = [];
  for (let run = 1; run <= page.runs; run++) {
    const { name, json, html } = runLighthouse(page, run);
    runs.push(summarize(json));
    reportFiles.push({ name, json: JSON.stringify(json), html });
    console.log(
      `${name}: ${CATEGORIES.map((c) => `${LABELS[c]} ${runs.at(-1).scores[c]}`).join(' · ')}`,
    );
  }
  const med = Object.fromEntries(CATEGORIES.map((c) => [c, median(runs.map((r) => r.scores[c]))]));
  rows.push({
    page,
    runs,
    med,
    lcp: median(runs.map((r) => r.lcp)),
    tbt: median(runs.map((r) => r.tbt)),
    cls: median(runs.map((r) => r.cls)),
    scriptKb: median(runs.map((r) => r.scriptKb)),
  });

  for (const category of CATEGORIES) {
    const blocking =
      page.kind === 'public' || category === 'accessibility' || category === 'best-practices';
    if (!blocking) continue;
    const min = category === 'performance' ? MIN_PERFORMANCE : MIN_OTHER;
    if (med[category] < min) {
      failures.push(
        `${page.path}: ${LABELS[category]} mediana ${med[category]} < ${min} (${runs.map((r) => r.scores[category]).join(', ')})`,
      );
    }
  }
}

let md = `# perf:check · ${LIGHTHOUSE} · mobile\n\nBase: ${BASE} · ${new Date().toISOString()} · ${RUNS} corrida(s) por página pública · umbral Performance ${MIN_PERFORMANCE}, resto ${MIN_OTHER}\n\n`;
md +=
  '| Página | Corridas | Perf | A11y | BP | SEO | LCP | TBT | CLS | JS (KB transf.) |\n|---|---|---|---|---|---|---|---|---|---|\n';
for (const { page, runs, med, lcp, tbt, cls, scriptKb } of rows) {
  const informative = page.kind === 'login' ? ' (SEO y Perf informativos)' : '';
  md += `| ${page.path}${informative} | ${runs.length} | ${med.performance} | ${med.accessibility} | ${med['best-practices']} | ${med.seo} | ${(lcp / 1000).toFixed(1)} s | ${Math.round(tbt)} ms | ${cls.toFixed(3)} | ${Math.round(scriptKb)} |\n`;
}
md += `\nPerformance por corrida: ${rows.map(({ page, runs }) => `${page.id} [${runs.map((r) => r.scores.performance).join(', ')}]`).join(' · ')}\n`;
md +=
  failures.length === 0
    ? '\nTodas las medianas cumplen el umbral.\n'
    : `\n## Fallas\n\n${failures.map((f) => `- ${f}`).join('\n')}\n`;

console.log(`\n${md}`);
if (OUT) {
  writeReport(OUT, 'lighthouse-summary.md', md);
  for (const file of reportFiles) {
    writeReport(OUT, `${file.name}.report.json`, file.json);
    writeReport(OUT, `${file.name}.report.html`, file.html);
  }
}
rmSync(tmp, { recursive: true, force: true });
process.exit(failures.length > 0 ? 1 : 0);

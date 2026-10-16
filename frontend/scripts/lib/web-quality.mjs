/**
 * Piezas comunes de `a11y:check` y `perf:check` (spec `web-accessibility` § Auditoría de
 * accesibilidad reproducible y `web-performance` § Umbral de Lighthouse verificable).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Chrome del sistema: `puppeteer-core` y Lighthouse no descargan navegador. */
export function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  const found = candidates.find((path) => existsSync(path));
  if (!found) {
    throw new Error('No encuentro Chrome: definí CHROME_PATH con la ruta del ejecutable.');
  }
  return found;
}

/**
 * Cada carga de una ruta pública registra una visita (`ProfileView`): contra la base de
 * verdad ensuciaría la analítica. El script se niega a correr sin la confirmación explícita
 * de que la API apunta a una base descartable (mismo criterio que `PRINT_CHECK_DISPOSABLE_DB`).
 */
export function requireDisposableDb(scriptName) {
  if (process.env.A11Y_CHECK_DISPOSABLE_DB === '1') return;
  console.error(
    [
      `${scriptName} se niega a correr: cada página que abre registra una visita en la base.`,
      'Definí A11Y_CHECK_DISPOSABLE_DB=1 solo si la API apunta a una base DESCARTABLE',
      '(local sembrada o el Postgres de servicio del CI), nunca a la base del owner.',
    ].join('\n'),
  );
  process.exit(2);
}

/** Argumentos: la primera posición es la base; `--out <dir>` pide guardar los reportes. */
export function parseArgs(argv = process.argv.slice(2)) {
  let out;
  let base;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') out = argv[++i];
    else if (!argv[i].startsWith('--') && base === undefined) base = argv[i];
  }
  return { base: (base ?? 'http://localhost:5173').replace(/\/+$/, ''), out };
}

/** Flags de Chrome: en CI (Linux, usuario sin namespaces) hace falta desactivar el sandbox. */
export function chromeFlags() {
  const flags = ['--headless=new', '--no-first-run', '--no-default-browser-check'];
  if (process.env.CI) flags.push('--no-sandbox', '--disable-dev-shm-usage');
  return flags;
}

export function writeReport(dir, name, content) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), content);
}

/** Mediana de una lista de números (promedia las dos del medio si es par). */
export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

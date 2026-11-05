#!/usr/bin/env node
/* global document, window, getComputedStyle, requestAnimationFrame */
/**
 * Auditoría de accesibilidad reproducible (spec `web-accessibility` § Auditoría de
 * accesibilidad reproducible, decisión D10 de `improve-a11y-and-performance`).
 *
 *   A11Y_CHECK_DISPOSABLE_DB=1 npm run a11y:check -- http://localhost:8080
 *   A11Y_CHECK_DISPOSABLE_DB=1 npm run a11y:check -- http://localhost:8080 --out reports
 *
 * Corre axe-core (versión exacta, devDependency) sobre la home, un perfil con cada preset ×
 * layout, `?lang=en`, los perfiles cuyo acento no llega a 4,5:1 contra su fondo, el 404 y
 * `/admin/login`, en mobile y escritorio; y un recorrido de teclado (salto al contenido como
 * primer foco, foco que llega al contenido y contraste ≥ 3:1 del indicador de cada control).
 * Con A11Y_CHECK_ADMIN_EMAIL y A11Y_CHECK_ADMIN_PASSWORD también audita el panel: la sesión
 * se abre con `fetch('/api/auth/login')` desde la página, sin escribir la contraseña en un campo.
 *
 * Entorno:
 *   A11Y_CHECK_DISPOSABLE_DB=1  OBLIGATORIA: la API tiene que apuntar a una base descartable
 *                         (cada carga registra una visita). Sin ella sale con código 2 sin abrir páginas.
 *   CHROME_PATH           Chrome del sistema.
 *   A11Y_CHECK_PROFILE    perfil base de la matriz de presets (por defecto `tech-lead-dotnet`). Con
 *                         los datos de ejemplo hay que definirlo: `A11Y_CHECK_PROFILE=ejemplo-backend`.
 *
 * Sale con código 1 ante cualquier violación `serious` o `critical` o ante una falla del teclado;
 * `moderate` y `minor` se informan sin bloquear. Sale con 2 si falta la variable de base descartable
 * o si el perfil base no resuelve en esta base (error de configuración, no de accesibilidad; no se
 * abre ninguna página).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer-core';
import {
  chromeFlags,
  findChrome,
  parseArgs,
  QUALITY_CHECK_UA_TOKEN,
  requireDisposableDb,
  writeReport,
} from './lib/web-quality.mjs';

requireDisposableDb('a11y:check');

const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');
const axeSource = readFileSync(axePath, 'utf8');
const axeVersion = JSON.parse(
  readFileSync(axePath.replace('axe.min.js', 'package.json'), 'utf8'),
).version;

const { base: BASE, out: OUT } = parseArgs();
const PROFILE = process.env.A11Y_CHECK_PROFILE ?? 'tech-lead-dotnet';
const ADMIN_EMAIL = process.env.A11Y_CHECK_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.A11Y_CHECK_ADMIN_PASSWORD;
const PRESETS = ['modern-dark', 'modern-light', 'minimal', 'elegant', 'corporate'];
const LAYOUTS = ['classic', 'sidebar'];
const VIEWPORTS = {
  mobile: { width: 375, height: 812, isMobile: true, hasTouch: true },
  desktop: { width: 1350, height: 940 },
};
const BLOCKING = new Set(['serious', 'critical']);
const FOCUS_MIN_CONTRAST = 3;
const AA_TEXT = 4.5;
const TAB_STEPS = 30;

// ---- Contraste (para elegir los perfiles con acento problemático) --------------------------

function luminance(hex) {
  const match = /^#?([a-f\d]{3}|[a-f\d]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const full = match[1].length === 3 ? [...match[1]].map((c) => c + c).join('') : match[1];
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return Infinity;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

async function getJson(path) {
  // Cada GET de un perfil registra una visita: el token la marca como BOT (classify-profile-views, D10).
  const response = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': QUALITY_CHECK_UA_TOKEN },
  });
  if (!response.ok) throw new Error(`GET ${path} respondió ${response.status}`);
  return response.json();
}

/** Perfiles cuyo acento no llega a 4,5:1 contra alguno de los fondos de su tema resuelto. */
async function accentProfiles() {
  const list = await getJson('/api/curated-profiles');
  const found = [];
  for (const { slug } of list) {
    const profile = await getJson(`/api/curated-profiles/${encodeURIComponent(slug)}`);
    const colors = profile.theme?.tokens?.colors;
    if (!colors?.accent) continue;
    const worst = Math.min(
      ...[colors.bg, colors.bgSoft, colors.card].map((s) => ratio(colors.accent, s)),
    );
    if (worst < AA_TEXT)
      found.push({ slug, accent: colors.accent, worst: Number(worst.toFixed(2)) });
  }
  return found;
}

// ---- Navegador -----------------------------------------------------------------------------

/** Recorre la página para disparar los `whileInView` (opacidad 0 hasta entrar en pantalla). */
async function settle(page) {
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {});
  await page.evaluate(async () => {
    const step = window.innerHeight / 2;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    window.scrollTo(0, 0);
  });
  await new Promise((resolve) => setTimeout(resolve, 900));
}

async function runAxe(page) {
  await page.evaluate(axeSource);
  return page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
      },
      resultTypes: ['violations'],
    });
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.map((n) => ({
        target: n.target.join(' '),
        html: n.html.slice(0, 160),
        summary: (n.failureSummary ?? '').slice(0, 240),
      })),
    }));
  });
}

/**
 * Teclado: el primer Tab cae en el enlace de salto, activarlo enfoca el `<main>`, y cada control
 * alcanzado con Tab muestra un contorno sólido de ≥ 2 px con ≥ 3:1 contra el fondo adyacente.
 */
async function keyboardWalk(page, { expectSkipLink }) {
  const problems = [];
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo(0, 0);
  });

  if (expectSkipLink) {
    await page.keyboard.press('Tab');
    const first = await page.evaluate(() => {
      const el = document.activeElement;
      return { text: el?.textContent?.trim() ?? '', href: el?.getAttribute?.('href') ?? '' };
    });
    if (
      !/^(Saltar al contenido|Skip to content)$/.test(first.text) ||
      first.href !== '#contenido'
    ) {
      problems.push(`el primer Tab no cae en «Saltar al contenido» (cayó en «${first.text}»)`);
    } else {
      await page.keyboard.press('Enter');
      const target = await page.evaluate(() => {
        const el = document.activeElement;
        return { tag: el?.tagName ?? '', id: el?.id ?? '' };
      });
      if (target.tag !== 'MAIN' || target.id !== 'contenido') {
        problems.push(
          `activar el salto no enfoca el <main id="contenido"> (enfocó ${target.tag}#${target.id})`,
        );
      }
      await page.keyboard.press('Tab');
      const next = await page.evaluate(() => {
        const el = document.activeElement;
        return { insideMain: Boolean(el?.closest?.('main')), tag: el?.tagName ?? '' };
      });
      if (!next.insideMain)
        problems.push('el Tab posterior al salto no entra al contenido del <main>');
      // El foco secuencial sigue desde el último elemento enfocado: se recarga para empezar de cero.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {});
    }
  }

  // Los botones animan el contorno (`transition-all`): se apagan las transiciones para medir
  // el color final del indicador y no un valor intermedio.
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });

  const rows = [];
  for (let i = 0; i < TAB_STEPS; i++) {
    await page.keyboard.press('Tab');
    await new Promise((resolve) => setTimeout(resolve, 40));
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      // Chrome devuelve `rgb()/rgba()` o, para `color-mix()`, `color(srgb r g b / a)` (canales 0–1).
      const parse = (value) => {
        const rgb = /rgba?\(([^)]+)\)/.exec(value);
        if (rgb) {
          const [r, g, b, a = 1] = rgb[1]
            .split(/[ ,/]+/)
            .filter(Boolean)
            .map(Number);
          return { r, g, b, a };
        }
        const srgb = /color\(srgb ([^)]+)\)/.exec(value);
        if (srgb) {
          const [r, g, b, a = 1] = srgb[1].split(/[ /]+/).filter(Boolean).map(Number);
          return { r: r * 255, g: g * 255, b: b * 255, a };
        }
        return null;
      };
      // Fondo adyacente: se compone desde la raíz hasta el padre (el contorno cae afuera, con offset).
      const chain = [];
      for (let node = el.parentElement; node; node = node.parentElement) chain.unshift(node);
      let bg = { r: 255, g: 255, b: 255 };
      for (const node of chain) {
        const c = parse(getComputedStyle(node).backgroundColor);
        if (c && c.a > 0) {
          bg = {
            r: c.r * c.a + bg.r * (1 - c.a),
            g: c.g * c.a + bg.g * (1 - c.a),
            b: c.b * c.a + bg.b * (1 - c.a),
          };
        }
      }
      const outline = parse(style.outlineColor);
      return {
        label: (
          el.getAttribute('aria-label') ||
          el.textContent ||
          el.getAttribute('href') ||
          el.tagName
        )
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 40),
        outlineStyle: style.outlineStyle,
        outlineWidth: parseFloat(style.outlineWidth),
        outline,
        bg,
        isMain: el.tagName === 'MAIN',
      };
    });
    if (info && !info.isMain) rows.push(info);
  }

  const lum = ({ r, g, b }) => {
    const lin = (v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  for (const row of rows) {
    if (row.outlineStyle === 'none' || !(row.outlineWidth >= 2) || !row.outline) {
      problems.push(`«${row.label}» no muestra un contorno sólido de 2 px al enfocarlo`);
      continue;
    }
    // Se mezcla el contorno con el fondo si fuera translúcido.
    const a = row.outline.a;
    const ink = {
      r: row.outline.r * a + row.bg.r * (1 - a),
      g: row.outline.g * a + row.bg.g * (1 - a),
      b: row.outline.b * a + row.bg.b * (1 - a),
    };
    const l1 = lum(ink);
    const l2 = lum(row.bg);
    const contrast = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    if (contrast < FOCUS_MIN_CONTRAST) {
      problems.push(
        `«${row.label}»: el indicador de foco mide ${contrast.toFixed(2)}:1 (mínimo ${FOCUS_MIN_CONTRAST}:1)`,
      );
    }
  }
  return { focusables: rows.length, problems };
}

// ---- Corrida -------------------------------------------------------------------------------

// El perfil base tiene que existir: si no, la matriz de presets auditaría un 404 sin avisar.
const baseProfile = await fetch(
  `${BASE}/api/curated-profiles/${encodeURIComponent(PROFILE)}`,
).catch(() => null);
if (!baseProfile?.ok) {
  console.error(
    `El perfil base «${PROFILE}» no existe en esta base: definí A11Y_CHECK_PROFILE con un slug público.`,
  );
  process.exit(2);
}

const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: true,
  args: chromeFlags().filter((flag) => flag !== '--headless=new'),
});

const consoleNotes = [];
const results = [];

async function audit(entry, viewportName, { keyboard = false, skipLink = true } = {}) {
  const page = await browser.newPage();
  await page.setViewport(VIEWPORTS[viewportName]);
  page.on('console', (m) => {
    if (m.type() === 'error')
      consoleNotes.push({ page: `${entry.id}.${viewportName}`, text: m.text().slice(0, 200) });
  });
  await page.goto(BASE + entry.path, { waitUntil: 'domcontentloaded' });
  await settle(page);
  const violations = await runAxe(page);
  const row = { page: entry.id, path: entry.path, viewport: viewportName, violations };
  if (keyboard) row.keyboard = await keyboardWalk(page, { expectSkipLink: skipLink });
  results.push(row);
  const summary = violations.map((v) => `${v.id}(${v.impact})x${v.nodes.length}`).join(', ');
  const kb = row.keyboard
    ? ` · teclado: ${row.keyboard.problems.length === 0 ? `ok (${row.keyboard.focusables} controles)` : `${row.keyboard.problems.length} problema(s)`}`
    : '';
  console.log(`${entry.id}.${viewportName}: ${summary || 'sin violaciones'}${kb}`);
  await page.close();
}

const accentList = await accentProfiles();
console.log(
  `Perfiles con acento bajo 4,5:1: ${accentList.map((p) => `${p.slug} ${p.accent} (${p.worst}:1)`).join(', ') || 'ninguno'}`,
);

const publicPages = [
  { id: 'home', path: '/', keyboard: true },
  { id: 'profile', path: `/${PROFILE}`, keyboard: true },
  {
    id: 'profile-en-dark-sidebar',
    path: `/${PROFILE}?lang=en&theme=modern-dark&layout=sidebar`,
    keyboard: true,
  },
  { id: 'not-found', path: '/no-existe-este-perfil' },
  { id: 'admin-login', path: '/admin/login', skipLink: false },
  ...PRESETS.flatMap((preset) =>
    LAYOUTS.map((layout) => ({
      id: `preset-${preset}-${layout}`,
      path: `/${PROFILE}?theme=${preset}&layout=${layout}`,
    })),
  ),
  ...accentList.map(({ slug }) => ({ id: `accent-${slug}`, path: `/${slug}` })),
];

for (const viewport of Object.keys(VIEWPORTS)) {
  for (const entry of publicPages) {
    await audit(entry, viewport, {
      keyboard: Boolean(entry.keyboard),
      skipLink: entry.skipLink !== false,
    });
  }
}

let adminAudited = false;
if (ADMIN_EMAIL && ADMIN_PASSWORD) {
  const session = await browser.newPage();
  await session.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle0' });
  // Login por `fetch` desde la página: la cookie httpOnly queda en el navegador y la contraseña
  // nunca se escribe en un campo.
  const status = await session.evaluate(
    async (email, password) =>
      (
        await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          credentials: 'same-origin',
        })
      ).status,
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
  );
  if (status !== 200 && status !== 201) {
    console.error(`El login del panel respondió ${status}: no se audita el panel.`);
    await browser.close();
    process.exit(1);
  }
  const profiles = await session.evaluate(async () =>
    (await fetch('/api/admin/curated-profiles', { credentials: 'same-origin' })).json(),
  );
  const first = (Array.isArray(profiles) ? profiles : (profiles.items ?? []))[0];
  await session.close();
  const adminPages = [
    ['admin', '/admin'],
    ['admin-portada', '/admin/portada'],
    ['admin-experiencias', '/admin/experiencias'],
    ['admin-skills', '/admin/skills'],
    ['admin-formacion', '/admin/formacion'],
    ['admin-proyectos', '/admin/proyectos'],
    ['admin-cuenta', '/admin/cuenta'],
    ['admin-perfiles', '/admin/perfiles'],
    ...(first?.id ? [['admin-builder', `/admin/perfiles/${first.id}`]] : []),
  ].map(([id, path]) => ({ id, path, keyboard: id === 'admin' || id === 'admin-builder' }));
  for (const viewport of Object.keys(VIEWPORTS)) {
    for (const entry of adminPages) await audit(entry, viewport, { keyboard: entry.keyboard });
  }
  adminAudited = true;
} else {
  console.log(
    'Sin A11Y_CHECK_ADMIN_EMAIL / A11Y_CHECK_ADMIN_PASSWORD: no se audita el panel autenticado.',
  );
}

await browser.close();

// ---- Resumen -------------------------------------------------------------------------------

const byRule = new Map();
for (const r of results) {
  for (const v of r.violations) {
    const key = `${v.id}|${v.impact}`;
    const e = byRule.get(key) ?? {
      id: v.id,
      impact: v.impact,
      nodes: 0,
      pages: new Set(),
      sample: v.nodes[0]?.target,
    };
    e.nodes += v.nodes.length;
    e.pages.add(`${r.page}.${r.viewport}`);
    byRule.set(key, e);
  }
}
const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
const rules = [...byRule.values()].sort((a, b) => order[a.impact] - order[b.impact]);
const blocking = rules.filter((r) => BLOCKING.has(r.impact));
const keyboardProblems = results.flatMap((r) =>
  (r.keyboard?.problems ?? []).map((p) => `${r.page}.${r.viewport}: ${p}`),
);

let md = `# a11y:check · axe-core ${axeVersion}\n\nBase: ${BASE} · ${new Date().toISOString()} · ${results.length} cargas${adminAudited ? ' (con panel)' : ' (sin panel)'}\n\n`;
md += '| Regla | Impacto | Nodos | Páginas | Ejemplo |\n|---|---|---|---|---|\n';
for (const e of rules) {
  md += `| ${e.id} | ${e.impact} | ${e.nodes} | ${e.pages.size}: ${[...e.pages].slice(0, 4).join(', ')}${e.pages.size > 4 ? ', …' : ''} | \`${e.sample}\` |\n`;
}
if (rules.length === 0) md += '| (ninguna) | | 0 | | |\n';
md += `\nViolaciones serious/critical: ${blocking.reduce((n, r) => n + r.nodes, 0)} nodos en ${blocking.length} regla(s).\n`;
md += `Recorrido de teclado: ${keyboardProblems.length === 0 ? 'sin problemas' : `${keyboardProblems.length} problema(s)`}.\n`;
for (const p of keyboardProblems) md += `- ${p}\n`;

console.log(`\n${md}`);
if (OUT) {
  writeReport(
    OUT,
    'axe.json',
    JSON.stringify(
      { axeVersion, base: BASE, date: new Date().toISOString(), results, console: consoleNotes },
      null,
      2,
    ),
  );
  writeReport(OUT, 'a11y-summary.md', md);
}
process.exit(blocking.length > 0 || keyboardProblems.length > 0 ? 1 : 0);

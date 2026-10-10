#!/usr/bin/env node
/* global document, getComputedStyle, NodeFilter */
/**
 * Verifica que la hoja imprimible de cada perfil cabe en UNA página (spec
 * `printable-curated-profile`, decisión D11 de `add-printable-one-page`).
 *
 *   npm run print:check                      # contra http://localhost:5173
 *   npm run print:check -- http://localhost:4173
 *
 * Entorno:
 *   CHROME_PATH           Chrome del sistema (puppeteer-core no descarga navegador).
 *   PRINT_CHECK_TOKENS    `slug=token,slug2=token2`: perfiles PROTECTED a sumar a la corrida.
 *   PRINT_CHECK_PAPERS    `A4,Letter` por defecto. Con un papel más chico (p. ej. `A5`) el
 *                         script tiene que fallar: sirve para comprobar que detecta desbordes.
 *   PRINT_CHECK_SLUGS     `slug,slug2`: solo esos perfiles (por defecto, el listado público + all).
 *   PRINT_CHECK_OUT       carpeta donde guardar cada PDF generado (por defecto, no guarda nada).
 *
 * Por cada perfil recorre es/en × tema del perfil / `?theme=modern-dark&layout=sidebar` y, para
 * cada papel, genera el PDF con `printBackground: false` (respetando el `@page` del CSS), cuenta
 * sus páginas y mide el contraste del texto de la hoja contra blanco. Sale con código 1 si algún
 * caso da más de una página, la hoja no se ve o el contraste es menor a 4,5:1.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const BASE = (process.argv[2] ?? 'http://localhost:5173').replace(/\/+$/, '');
const MIN_CONTRAST = 4.5;
const OUT_DIR = process.env.PRINT_CHECK_OUT;
if (OUT_DIR) mkdirSync(OUT_DIR, { recursive: true });
const LOCALES = ['es', 'en'];
const VARIANTS = [
  { name: 'perfil', query: '' },
  { name: 'dark+sidebar', query: 'theme=modern-dark&layout=sidebar' },
];
const PAPERS = (process.env.PRINT_CHECK_PAPERS ?? 'A4,Letter').split(',').map((p) => p.trim());

function findChrome() {
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

function parseTokens(value) {
  const tokens = new Map();
  for (const pair of (value ?? '').split(',').filter(Boolean)) {
    const [slug, ...rest] = pair.split('=');
    if (slug && rest.length > 0) tokens.set(slug.trim(), rest.join('=').trim());
  }
  return tokens;
}

async function listSlugs(tokens) {
  const only = process.env.PRINT_CHECK_SLUGS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (only?.length) return only;
  const response = await fetch(`${BASE}/api/curated-profiles`);
  if (!response.ok) throw new Error(`GET /api/curated-profiles respondió ${response.status}`);
  const list = await response.json();
  return [...new Set([...list.map((p) => p.slug), 'all', ...tokens.keys()])];
}

/** Páginas de un PDF: objetos `/Type /Page` (no `/Pages`). */
function countPages(pdf) {
  const text = Buffer.from(pdf).toString('latin1');
  return (text.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
}

/** En el navegador: visibilidad de la hoja y contraste mínimo del texto contra blanco. */
function inspectSheet() {
  const sheet = document.querySelector('[data-print-sheet]');
  if (!sheet) return { visible: false, screenHidden: false, minContrast: 0, worst: '' };

  const toLinear = (channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = ([r, g, b]) =>
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  const parse = (value) => {
    const match = value.match(/rgba?\(([^)]+)\)/);
    if (!match) return null;
    const [r, g, b, a = 1] = match[1]
      .split(/[ ,/]+/)
      .filter(Boolean)
      .map(Number);
    // Mezcla con el blanco del papel si el color es translúcido.
    return [r, g, b].map((channel) => Math.round(channel * a + 255 * (1 - a)));
  };
  const white = luminance([255, 255, 255]);

  let minContrast = Infinity;
  let worst = '';
  const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim();
    const element = node.parentElement;
    if (!text || !element) continue;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const rgb = parse(style.color);
    if (!rgb) continue;
    const l = luminance(rgb);
    const ratio = (white + 0.05) / (l + 0.05);
    if (ratio < minContrast) {
      minContrast = ratio;
      worst = text.slice(0, 40);
    }
  }

  const rect = sheet.getBoundingClientRect();
  const main = document.querySelector('main');
  const mainRect = main?.getBoundingClientRect();
  return {
    visible: getComputedStyle(sheet).display !== 'none' && rect.height > 0,
    screenHidden: !main || getComputedStyle(main).display === 'none' || mainRect.height === 0,
    minContrast: Number.isFinite(minContrast) ? minContrast : 0,
    worst,
  };
}

async function main() {
  const tokens = parseTokens(process.env.PRINT_CHECK_TOKENS);
  const slugs = await listSlugs(tokens);
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: process.env.CI ? ['--no-sandbox'] : [],
  });

  const rows = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.emulateMediaType('print');

    for (const slug of slugs) {
      for (const variant of VARIANTS) {
        for (const locale of LOCALES) {
          const params = new URLSearchParams(variant.query);
          params.set('lang', locale);
          if (tokens.has(slug)) params.set('token', tokens.get(slug));
          const path = slug === 'all' ? '/' : `/${slug}`;
          const row = { slug, variant: variant.name, locale, pages: {}, contrast: 0, problems: [] };
          rows.push(row);

          try {
            await page.goto(`${BASE}${path}?${params}`, { waitUntil: 'networkidle0' });
            await page.waitForSelector('[data-print-sheet]', { timeout: 15000 });
            await page.evaluate(() => document.fonts.ready);
            const info = await page.evaluate(inspectSheet);
            row.contrast = info.minContrast;
            if (!info.visible) row.problems.push('la hoja no se ve al imprimir');
            if (!info.screenHidden) row.problems.push('el layout de pantalla se ve al imprimir');
            if (info.minContrast < MIN_CONTRAST) {
              row.problems.push(`contraste ${info.minContrast.toFixed(2)}:1 en "${info.worst}"`);
            }
            for (const paper of PAPERS) {
              const pdf = await page.pdf({ format: paper, printBackground: false });
              row.pages[paper] = countPages(pdf);
              if (OUT_DIR) {
                writeFileSync(join(OUT_DIR, `${slug}-${variant.name}-${locale}-${paper}.pdf`), pdf);
              }
              if (row.pages[paper] !== 1)
                row.problems.push(`${paper}: ${row.pages[paper]} páginas`);
            }
          } catch (error) {
            row.problems.push(`error: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    }
  } finally {
    await browser.close();
  }

  const header = ['perfil', 'tema', 'idioma', ...PAPERS, 'contraste', 'estado'];
  const table = rows.map((row) => [
    row.slug,
    row.variant,
    row.locale,
    ...PAPERS.map((paper) => String(row.pages[paper] ?? '-')),
    row.contrast ? `${row.contrast.toFixed(1)}:1` : '-',
    row.problems.length === 0 ? 'OK' : `FALLA (${row.problems.join('; ')})`,
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...table.map((r) => r[i].length)));
  const line = (cells) => cells.map((cell, i) => cell.padEnd(widths[i])).join('  ');
  console.log(`print:check contra ${BASE}`);
  console.log(line(header));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const cells of table) console.log(line(cells));

  const failed = rows.filter((row) => row.problems.length > 0);
  console.log(
    `\n${rows.length} casos (${slugs.length} perfiles), ${failed.length} con problemas. ` +
      `Contraste mínimo: ${Math.min(...rows.map((r) => r.contrast || Infinity)).toFixed(2)}:1`,
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

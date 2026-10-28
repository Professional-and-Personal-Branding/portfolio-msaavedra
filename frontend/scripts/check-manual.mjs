#!/usr/bin/env node
/**
 * Comprobación del manual (change `add-learning-guide-and-example-data`, D13).
 *
 *   npm run manual:check [-- --root <dir-con-docs/> --src <dir-con-el-codigo>]
 *
 * Sin navegador, sin base y sin dependencias: lee `docs/MANUAL.md`, `docs/manual/index.html`, las
 * imágenes de `docs/manual/` y el código de `frontend/src`. Sale con código 1 (y lista cada
 * problema con archivo y línea) si:
 *
 *  1. Los casos de `MANUAL.md` (`### TC-nn — Título <estado>`) y los de `index.html`
 *     (`<article class="case" data-status id="tcnn">` con su `<h3>`) difieren en ids, títulos o
 *     estado (✅ ↔ ok, 🔍 ↔ part, ❌ ↔ fail), o si la tabla de la suite (§ 6) o el índice lateral
 *     del HTML no listan exactamente esos casos. Lo mismo para los conceptos (C), recorridos (R),
 *     pantallas del backoffice (B) y el glosario.
 *  2. Una imagen referenciada no existe, o un .jpg/.png de `docs/manual/` no está referenciado
 *     por los dos formatos o no figura en el manifiesto de `manual:capture`.
 *  3. Una imagen pasa de 150 KB, el total de imágenes de 4 MB o `index.html` de 300 KB.
 *  4. Un mensaje de validación citado (columna *Mensaje* en Markdown, `td.msg` en el HTML) no
 *     aparece literal en `frontend/src`.
 *  5. Un `href="#…"` del HTML apunta a un id que no existe.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
};
const DOCS = join(flag('--root', join(here, '../..')), 'docs');
const SRC = flag('--src', join(here, '../src'));
const CAPTURE_SCRIPT = flag('--capture', join(here, 'capture-manual.mjs'));
const MANUAL_DIR = join(DOCS, 'manual');
const MD_FILE = join(DOCS, 'MANUAL.md');
const HTML_FILE = join(MANUAL_DIR, 'index.html');

const MAX_IMAGE = 150 * 1024;
const MAX_IMAGES_TOTAL = 4 * 1024 * 1024;
const MAX_HTML = 300 * 1024;

const problems = [];
const report = (file, line, message) => problems.push({ file: relative(process.cwd(), file), line, message });

const read = (file) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const decode = (s) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const md = read(MD_FILE);
const html = read(HTML_FILE);
const STATUS = { '✅': 'ok', '🔍': 'part', '❌': 'fail' };

// ── 1. Alineación de casos y secciones ───────────────────────────────────────
const mdCases = new Map();
for (const m of md.matchAll(/^### (TC-\d+) — (.*?) (✅|🔍|❌)\s*$/gm)) {
  mdCases.set(m[1], { title: m[2].trim(), status: STATUS[m[3]], line: lineOf(md, m.index) });
}
const htmlCases = new Map();
for (const m of html.matchAll(
  /<article class="case" data-status="(\w+)" id="(tc\d+)"[^>]*>\s*<div class="case-head"><span class="case-id">(TC-\d+)<\/span><h3>(.*?)<\/h3>/g,
)) {
  if (`tc${m[3].slice(3)}` !== m[2]) {
    report(HTML_FILE, lineOf(html, m.index), `${m[3]}: el id "${m[2]}" no corresponde al número del caso`);
  }
  htmlCases.set(m[3], { title: decode(m[4]), status: m[1], line: lineOf(html, m.index) });
}

for (const [tc, c] of mdCases) {
  const h = htmlCases.get(tc);
  if (!h) {
    report(MD_FILE, c.line, `${tc} está en MANUAL.md y no en index.html`);
    continue;
  }
  if (h.title !== c.title) {
    report(HTML_FILE, h.line, `${tc}: el título difiere ("${h.title}" en el HTML, "${c.title}" en el Markdown)`);
  }
  if (h.status !== c.status) {
    report(HTML_FILE, h.line, `${tc}: el estado difiere (${h.status} en el HTML, ${c.status} en el Markdown)`);
  }
}
for (const [tc, h] of htmlCases) {
  if (!mdCases.has(tc)) report(HTML_FILE, h.line, `${tc} está en index.html y no en MANUAL.md`);
}

// Tabla de la suite (§ 6): `| TC-nn | título | estado | evidencia |`.
const suiteRows = new Map();
for (const m of md.matchAll(/^\| (TC-\d+) \| .*? \| (✅|🔍|❌) \|/gm)) {
  suiteRows.set(m[1], { status: STATUS[m[2]], line: lineOf(md, m.index) });
}
for (const tc of mdCases.keys()) {
  const row = suiteRows.get(tc);
  if (!row) report(MD_FILE, 1, `${tc} no figura en la tabla de la suite (§ 6)`);
  else if (row.status !== mdCases.get(tc).status) {
    report(MD_FILE, row.line, `${tc}: el estado de la tabla de la suite no es el del caso`);
  }
}
for (const [tc, row] of suiteRows) {
  if (!mdCases.has(tc)) report(MD_FILE, row.line, `${tc} figura en la tabla de la suite y no es un caso`);
}

// Índice lateral del HTML: `<a href="#tcnn"><span class="dot ok">…`.
const sideCases = new Map();
for (const m of html.matchAll(/<a href="#(tc\d+)"><span class="dot (\w+)"><\/span><span class="id">(TC-\d+)<\/span>/g)) {
  sideCases.set(m[3], { status: m[2], line: lineOf(html, m.index) });
}
for (const tc of htmlCases.keys()) {
  const side = sideCases.get(tc);
  if (!side) report(HTML_FILE, 1, `${tc} no figura en el índice lateral`);
  else if (side.status !== htmlCases.get(tc).status) {
    report(HTML_FILE, side.line, `${tc}: el punto del índice lateral no es el estado del caso`);
  }
}
for (const [tc, side] of sideCases) {
  if (!htmlCases.has(tc)) report(HTML_FILE, side.line, `${tc} figura en el índice lateral y no es un caso`);
}

// Secciones de aprendizaje: conceptos (C), recorridos (R) y pantallas del backoffice (B).
const SECTION_KINDS = [
  { prefix: 'C', md: /^### (C\d+) — (.*)$/gm, html: /<article class="concept" id="(c\d+)"[^>]*>\s*<h3>(.*?)<\/h3>/g, label: 'concepto' },
  { prefix: 'R', md: /^### (R\d+) — (.*)$/gm, html: /<article class="tour" id="(r\d+)"[^>]*>\s*<h3>(.*?)<\/h3>/g, label: 'recorrido' },
  { prefix: 'B', md: /^### (B\d+) — (.*)$/gm, html: /<article class="screen" id="(b\d+)"[^>]*>\s*<h3>(.*?)<\/h3>/g, label: 'pantalla del backoffice' },
];
for (const kind of SECTION_KINDS) {
  const fromMd = new Map([...md.matchAll(kind.md)].map((m) => [m[1], { title: m[2].trim(), line: lineOf(md, m.index) }]));
  const fromHtml = new Map(
    [...html.matchAll(kind.html)].map((m) => [m[1].toUpperCase(), { title: decode(m[2]), line: lineOf(html, m.index) }]),
  );
  for (const [id, item] of fromMd) {
    const other = fromHtml.get(id);
    if (!other) report(MD_FILE, item.line, `${kind.label} ${id} está en MANUAL.md y no en index.html`);
    else if (other.title !== item.title) {
      report(HTML_FILE, other.line, `${kind.label} ${id}: el título difiere ("${other.title}" vs "${item.title}")`);
    }
  }
  for (const [id, item] of fromHtml) {
    if (!fromMd.has(id)) report(HTML_FILE, item.line, `${kind.label} ${id} está en index.html y no en MANUAL.md`);
  }
}
const glossaryAt = md.indexOf('\n## 9. Glosario');
const mdTerms = glossaryAt < 0 ? [] : [...md.slice(glossaryAt).matchAll(/^\| \*\*(.+?)\*\* \|/gm)].map((m) => m[1].replace(/`/g, ''));
const htmlTerms = [...html.matchAll(/<dt id="g-[^"]*">(.*?)<\/dt>/g)].map((m) => decode(m[1]));
if (mdTerms.length !== htmlTerms.length) {
  report(HTML_FILE, 1, `el glosario tiene ${htmlTerms.length} términos en el HTML y ${mdTerms.length} en el Markdown`);
}

// ── 2 y 3. Imágenes y tamaños ────────────────────────────────────────────────
const imageFiles = readdirSync(MANUAL_DIR).filter((f) => /\.(jpe?g|png)$/i.test(f));
const mdImages = new Map();
for (const m of md.matchAll(/!\[[^\]]*\]\(manual\/([^)]+)\)/g)) mdImages.set(m[1], lineOf(md, m.index));
const htmlImages = new Map();
for (const m of html.matchAll(/<img [^>]*src="([^"]+)"/g)) htmlImages.set(m[1], lineOf(html, m.index));
const captureScript = existsSync(CAPTURE_SCRIPT) ? read(CAPTURE_SCRIPT) : '';

for (const [name, line] of mdImages) {
  if (!existsSync(join(MANUAL_DIR, name))) report(MD_FILE, line, `la imagen ${name} no existe en docs/manual/`);
}
for (const [name, line] of htmlImages) {
  if (!existsSync(join(MANUAL_DIR, name))) report(HTML_FILE, line, `la imagen ${name} no existe en docs/manual/`);
}
let totalImages = 0;
for (const name of imageFiles) {
  const size = statSync(join(MANUAL_DIR, name)).size;
  totalImages += size;
  if (!mdImages.has(name) && !htmlImages.has(name)) {
    report(join(MANUAL_DIR, name), 1, `imagen huérfana: ni MANUAL.md ni index.html la referencian`);
  } else if (!mdImages.has(name) || !htmlImages.has(name)) {
    report(join(MANUAL_DIR, name), 1, `la imagen la referencia solo ${mdImages.has(name) ? 'MANUAL.md' : 'index.html'}`);
  }
  const id = name.replace(/\.(jpe?g|png)$/i, '');
  if (captureScript && !new RegExp(`id: '${id}'`).test(captureScript)) {
    report(join(MANUAL_DIR, name), 1, `${name} no figura en el manifiesto de manual:capture`);
  }
  if (size > MAX_IMAGE) {
    report(join(MANUAL_DIR, name), 1, `pesa ${(size / 1024).toFixed(0)} KB y el tope es 150 KB`);
  }
}
if (totalImages > MAX_IMAGES_TOTAL) {
  report(MANUAL_DIR, 1, `las imágenes suman ${(totalImages / 1048576).toFixed(2)} MB y el tope es 4 MB`);
}
const htmlSize = statSync(HTML_FILE).size;
if (htmlSize > MAX_HTML) {
  report(HTML_FILE, 1, `index.html pesa ${(htmlSize / 1024).toFixed(0)} KB y el tope es 300 KB`);
}

// ── 4. Mensajes de validación literales ──────────────────────────────────────
function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) out.push(full);
  }
  return out;
}
const sourceText = existsSync(SRC) ? sourceFiles(SRC).map((f) => read(f)).join('\n') : '';

function checkMessage(file, line, message) {
  if (message === '' || message === '—') return;
  // El código puede escribir la comilla tipográfica o el apóstrofo escapado.
  const variants = [message, message.replace(/'/g, "\\'"), message.replace(/"/g, '\\"')];
  if (!variants.some((v) => sourceText.includes(v))) {
    report(file, line, `el mensaje "${message}" no aparece literal en frontend/src`);
  }
}
// Markdown: columna "Mensaje" de cada tabla.
const mdLines = md.split('\n');
for (let i = 0; i < mdLines.length; i++) {
  const header = mdLines[i];
  if (!/^\|.*\bMensaje\b.*\|/.test(header) || !/^\|[\s:|-]+\|$/.test(mdLines[i + 1] ?? '')) continue;
  const cells = (row) => row.split('|').slice(1, -1).map((c) => c.trim());
  const col = cells(header).findIndex((c) => c === 'Mensaje');
  for (let j = i + 2; j < mdLines.length && mdLines[j].startsWith('|'); j++) {
    const raw = cells(mdLines[j])[col] ?? '';
    for (const part of raw.split(/<br\s*\/?>/)) {
      checkMessage(MD_FILE, j + 1, part.replace(/^`+|`+$/g, '').replace(/^["«]|["»]$/g, '').trim());
    }
  }
}
// HTML: <td class="msg">…</td>.
for (const m of html.matchAll(/<td class="msg">(.*?)<\/td>/g)) {
  for (const part of m[1].split(/<br\s*\/?>/)) checkMessage(HTML_FILE, lineOf(html, m.index), decode(part));
}

// ── 5. Anclas internas ───────────────────────────────────────────────────────
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
for (const m of html.matchAll(/href="#([^"]+)"/g)) {
  if (!ids.has(m[1])) report(HTML_FILE, lineOf(html, m.index), `el ancla #${m[1]} apunta a un id que no existe`);
}

// ── Resultado ────────────────────────────────────────────────────────────────
if (problems.length > 0) {
  for (const p of problems) console.error(`${p.file}:${p.line}  ${p.message}`);
  console.error(`\nmanual:check falló: ${problems.length} problema(s).`);
  process.exit(1);
}
console.log(
  `manual:check ok: ${mdCases.size} casos alineados, ${imageFiles.length} imágenes (${(totalImages / 1048576).toFixed(2)} MB), index.html ${(htmlSize / 1024).toFixed(0)} KB, ${ids.size} ids.`,
);

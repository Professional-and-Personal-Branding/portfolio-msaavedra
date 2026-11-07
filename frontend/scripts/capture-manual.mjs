#!/usr/bin/env node
/* global document, window */
/**
 * Capturas reproducibles del manual (change `add-learning-guide-and-example-data`, D11, D12).
 *
 *   MANUAL_CAPTURE_DISPOSABLE_DB=1 \
 *   MANUAL_CAPTURE_ADMIN_EMAIL=capture@example.com MANUAL_CAPTURE_ADMIN_PASSWORD=... \
 *   npm run manual:capture -- http://localhost:5190
 *   npm run manual:capture -- http://localhost:5190 --only tc19b-formulario,tc01-home-es
 *
 * Genera todas las imágenes de `docs/manual/` desde el manifiesto de abajo, con `puppeteer-core`
 * y el Chrome del sistema: JPEG de calidad 78, 1280x800 en escritorio y 390x844 en móvil, con
 * movimiento reducido. Pensado para correr contra el frontend servido (imagen de
 * `frontend/Dockerfile` o `vite dev` con `VITE_PROXY_TARGET`) cuya API apunta a la BASE DE EJEMPLO
 * (`npm run seed:example` en una base descartable).
 *
 * Guardas (código 2, antes de abrir ninguna página):
 *   - exige MANUAL_CAPTURE_DISPOSABLE_DB=1: las cargas públicas registran visitas;
 *   - `GET /api/profile` debe devolver el `fullName` de `docs/examples/cv-data.example.json`.
 *
 * Sin escrituras, salvo dos: el inicio de sesión (`fetch('/api/auth/login')` desde la página, con
 * credenciales de prueba por variables de entorno) y, para la captura `tc41-enlaces` (change
 * `add-share-links`), la creación de UN enlace de seguimiento de ejemplo por la API del panel
 * (`POST /api/admin/curated-profiles/:id/share-links`, solo si el perfil todavía no tiene uno con
 * esa etiqueta). El script no hace ningún otro POST, PATCH ni DELETE, y
 * nunca escribe una contraseña real en un campo: la captura del error de credenciales usa un
 * email inexistente y un valor de relleno que no pertenece a nadie, y la de Cuenta (`bo-cuenta`)
 * solo valores de relleno que la validación del cliente rechaza sin enviar nada. Los errores de validación
 * se provocan con *Guardar* sobre un formulario vacío (valida en el cliente) y los avisos de
 * cambios sin guardar se abren y se cierran con *Cancelar*.
 */
import { readFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { chromeFlags, findChrome } from './lib/web-quality.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(here, '../../docs/manual');
const EXAMPLE = join(here, '../../docs/examples/cv-data.example.json');

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith('--')) ?? 'http://localhost:5173').replace(/\/+$/, '');
const onlyFlag = args.indexOf('--only');
const only = onlyFlag >= 0 ? new Set(args[onlyFlag + 1].split(',')) : null;

const VIEWPORTS = {
  desktop: { width: 1280, height: 800, deviceScaleFactor: 1 },
  mobile: { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
};
const JPEG_QUALITY = 78;
const MAX_BYTES = 150 * 1024;
/** Token del perfil protegido del ejemplo (documentado en docs/DATA-POPULATION.md). */
const EXAMPLE_TOKEN = 'ejemplo-token-2026';

// ── Manifiesto ────────────────────────────────────────────────────────────────
// `ruta`: se abre tal cual (`{id:slug}` se reemplaza por el id del perfil curado).
// `sesion`: requiere el panel abierto. `pasos`: acciones sin escritura. `recorte`: selector CSS
// o `{ fullPage: true }`. `viewport`: escritorio por defecto.
const L = '?lang=es';
const MANIFEST = [
  // El dashboard va primero: las cargas públicas siguientes registran visitas.
  { id: 'tc18-dashboard', ruta: '/admin', sesion: true, esperar: 'Por origen', recorte: { fullPage: true } },
  { id: 'tc11-login', ruta: '/admin/login', limpio: true },
  {
    id: 'tc11-login-error',
    ruta: '/admin/login',
    limpio: true,
    pasos: [
      ['type', 'input[type="email"]', 'nadie@example.com'],
      ['type', 'input[type="password"]', 'relleno-que-no-es-de-nadie'],
      ['click', 'button[type="submit"]'],
      ['esperarTexto', 'Email o contraseña incorrectos'],
    ],
  },
  { id: 'tc01-home-es', ruta: `/${L}` },
  { id: 'tc02-home-en', ruta: '/?lang=en' },
  { id: 'tc03-perfil-curado', ruta: `/ejemplo-backend${L}` },
  {
    id: 'tc04-tema-layout',
    ruta: `/ejemplo-backend${L}&theme=corporate&layout=sidebar`,
  },
  {
    id: 'tc05-menu-perfiles',
    ruta: `/${L}`,
    pasos: [['click', 'aria/Perfiles[role="button"]'], ['esperar', 700]],
  },
  { id: 'tc06-token-form', ruta: `/ejemplo-protegido${L}` },
  { id: 'tc07-token-resuelto', ruta: `/ejemplo-protegido${L}&token=${EXAMPLE_TOKEN}` },
  { id: 'tc08-404', ruta: `/ejemplo-borrador${L}` },
  { id: 'tc09-movil', ruta: `/ejemplo-backend${L}`, viewport: 'mobile' },
  { id: 'tc24-alias', ruta: `/ejemplo-nombre-anterior${L}` },
  { id: 'tc31-imprimir', ruta: `/ejemplo-backend${L}`, impresion: true, recorte: { fullPage: true } },
  {
    id: 'tc33-foco',
    ruta: `/ejemplo-backend${L}`,
    pasos: [['tecla', 'Tab'], ['esperar', 400]],
  },
  { id: 'tc34-acento', ruta: `/ejemplo-backend${L}&theme=modern-light` },
  { id: 'tc35-movil-hero', ruta: `/ejemplo-backend${L}`, viewport: 'mobile' },
  { id: 'tc36-ejemplo-home', ruta: `/${L}`, recorte: { fullPage: true, altoMax: 1700 } },
  // ── Panel ──
  { id: 'tc12a-perfiles-lista', ruta: '/admin/perfiles', sesion: true, esperar: 'ejemplo-backend' },
  { id: 'tc12b-identidad', ruta: '/admin/perfiles/{id:ejemplo-backend}', sesion: true, esperar: 'Slug' },
  {
    id: 'tc13-seleccion',
    ruta: '/admin/perfiles/{id:ejemplo-overrides}',
    sesion: true,
    esperar: 'Slug',
    pasos: [['click', 'aria/Selección[role="tab"]'], ['esperar', 900]],
  },
  {
    // Change add-builder-skill-project-overrides: Skills (Kotlin excluida, «1 excluida» en su
    // categoría) y Proyectos (con el oculto marcado) de ejemplo-overrides, con los overrides del seed.
    id: 'tc43-overrides',
    ruta: '/admin/perfiles/{id:ejemplo-overrides}',
    sesion: true,
    esperar: 'Slug',
    pasos: [
      ['click', 'aria/Selección[role="tab"]'],
      ['esperar', 900],
      ['verSeccion', '[role="region"][aria-label="Skills"]'],
      ['esperar', 500],
    ],
  },
  {
    id: 'tc14-secciones',
    ruta: '/admin/perfiles/{id:ejemplo-secciones}',
    sesion: true,
    esperar: 'Slug',
    pasos: [['click', 'aria/Diseño[role="tab"]'], ['esperar', 900]],
  },
  {
    id: 'tc15-tema',
    ruta: '/admin/perfiles/{id:ejemplo-backend}',
    sesion: true,
    esperar: 'Slug',
    pasos: [['click', 'aria/Diseño[role="tab"]'], ['esperar', 900]],
  },
  {
    id: 'bo-constructor-diseno',
    ruta: '/admin/perfiles/{id:ejemplo-secciones}',
    sesion: true,
    esperar: 'Slug',
    pasos: [['click', 'aria/Diseño[role="tab"]'], ['esperar', 900]],
    recorte: { fullPage: true },
  },
  {
    id: 'tc16-publicacion',
    ruta: '/admin/perfiles/{id:ejemplo-protegido}',
    sesion: true,
    esperar: 'Slug',
    pasos: [['click', 'aria/Publicación[role="tab"]'], ['esperar', 700]],
  },
  {
    id: 'tc41-enlaces',
    ruta: '/admin/perfiles/{id:ejemplo-backend}',
    sesion: true,
    esperar: 'Slug',
    preparar: 'enlace-de-ejemplo',
    pasos: [
      ['click', 'aria/Publicación[role="tab"]'],
      ['esperarTexto', 'Cobalto — Laura, RR. HH.'],
      ['verEnlaces'],
      ['esperar', 600],
    ],
  },
  {
    id: 'tc17-preview-en',
    ruta: '/admin/perfiles/{id:ejemplo-backend}',
    sesion: true,
    esperar: 'Slug',
    pasos: [
      ['type', '#slug', 'ejemplo-backend-vacante'],
      ['click', '[aria-label="Idioma de la vista previa"] [role="tab"]:nth-child(2)'],
      ['esperar', 1500],
    ],
  },
  {
    id: 'tc22-archivado',
    ruta: '/admin/perfiles/{id:ejemplo-archivado}',
    sesion: true,
    esperar: 'Slug',
    pasos: [['click', 'aria/Publicación[role="tab"]'], ['esperar', 700]],
  },
  {
    id: 'tc23-dirigido',
    ruta: '/admin/perfiles/{id:ejemplo-dirigido}',
    sesion: true,
    esperar: 'Slug',
    pasos: [['click', 'aria/Publicación[role="tab"]'], ['esperar', 700]],
  },
  {
    id: 'tc21-duplicar',
    ruta: '/admin/perfiles',
    sesion: true,
    esperar: 'ejemplo-backend',
    pasos: [['click', 'aria/Duplicar ejemplo-backend'], ['esperarTexto', 'Duplicar perfil curado'], ['esperar', 500]],
  },
  {
    id: 'tc32-faltantes',
    ruta: '/admin/perfiles/{id:ejemplo-borrador}',
    sesion: true,
    esperar: 'Slug',
    pasos: [
      ['click', 'aria/Publicación[role="tab"]'],
      ['click', '[aria-label="Idioma de la vista previa"] [role="tab"]:nth-child(2)'],
      ['esperarTexto', 'Falta 1 traducción en EN'],
      ['esperar', 600],
    ],  },
  { id: 'tc19a-experiencias', ruta: '/admin/experiencias', sesion: true, esperar: 'Cobalto Ejemplo' },
  {
    id: 'tc19b-formulario',
    ruta: '/admin/experiencias',
    sesion: true,
    esperar: 'Cobalto Ejemplo',
    pasos: [['click', 'aria/Editar Cobalto Ejemplo'], ['esperarTexto', 'Logros (en)'], ['esperar', 500]],
  },
  {
    id: 'bo-experiencia-errores',
    ruta: '/admin/experiencias',
    sesion: true,
    esperar: 'Cobalto Ejemplo',
    pasos: [
      ['click', 'aria/Nueva experiencia[role="button"]'],
      ['esperarTexto', 'Logros (en)'],
      ['click', 'aria/Guardar[role="button"]'],
      ['esperar', 600],
    ],
  },
  { id: 'tc20-skills', ruta: '/admin/skills', sesion: true, esperar: 'Spring Boot' },
  // Revisión del CV (change `add-cv-consistency-rules`, B16 y TC-47): solo lectura, sobre el ejemplo.
  { id: 'bo-revision', ruta: '/admin/revision', sesion: true, esperar: 'Sugerencias' },
  // Cuenta (change `add-admin-password-change`): el formulario con «Las contraseñas no coinciden».
  // Valores de relleno que no pertenecen a nadie; la validación es del cliente y no sale ninguna
  // petición (no se pulsa nada que envíe: el error aparece al salir del último campo).
  {
    id: 'bo-cuenta',
    ruta: '/admin/cuenta',
    sesion: true,
    esperar: 'Cambiar contraseña',
    pasos: [
      ['type', '#current-password', 'relleno-actual-sin-uso'],
      ['type', '#new-password', 'relleno-nueva-sin-uso-1'],
      ['type', '#confirm-password', 'relleno-nueva-sin-uso-2'],
      ['click', 'aria/Nueva contraseña'],
      ['esperarTexto', 'Las contraseñas no coinciden'],
      ['esperar', 400],
    ],
  },
  {
    id: 'bo-skills-dialogo',
    ruta: '/admin/skills',
    sesion: true,
    esperar: 'Spring Boot',
    pasos: [['click', 'aria/Editar Spring Boot'], ['esperarTexto', 'Nueva skill', 'Editar skill'], ['esperar', 500]],
  },
  { id: 'tc25-portada', ruta: '/admin/portada', sesion: true, esperar: 'Identidad y contacto' },
  {
    id: 'bo-portada-idioma',
    ruta: '/admin/portada',
    sesion: true,
    esperar: 'Identidad y contacto',
    pasos: [['click', 'aria/Editar Inglés'], ['esperarTexto', 'Nivel'], ['esperar', 500]],
  },
  { id: 'tc26-formacion', ruta: '/admin/formacion', sesion: true, esperar: 'Universidad Ejemplo' },
  {
    id: 'bo-formacion-certificacion',
    ruta: '/admin/formacion',
    sesion: true,
    esperar: 'Universidad Ejemplo',
    pasos: [
      ['click', 'aria/Nueva certificación[role="button"]'],
      ['esperarTexto', 'Emisor'],
      ['type', '#certification-year', '20x'],
      ['type', '#certification-verification-url', 'http://example.org/credenciales/1'],
      ['click', 'aria/Guardar[role="button"]'],
      ['esperar', 600],
    ],
  },
  // TC-42 (change `add-certification-verification`): la sección pública con «Ver credencial»
  // (primera certificación del ejemplo) y «Vencida» (segunda). Sin escrituras.
  {
    id: 'tc42-credencial',
    ruta: `/${L}`,
    pasos: [['verSeccion', '#certifications'], ['esperar', 700]],
    recorte: { fullPage: false },
  },
  { id: 'tc27-proyectos', ruta: '/admin/proyectos', sesion: true, esperar: 'Plataforma de Reservas' },
  {
    id: 'bo-enlace-stats',
    ruta: '/admin/proyectos',
    sesion: true,
    esperar: 'Plataforma de Reservas',
    pasos: [
      ['click', 'aria/Editar enlace Código y proyectos abiertos'],
      ['esperarTexto', 'Estadísticas (JSON)'],
      ['borrarYEscribir', '#link-stats', '{ no es json'],
      ['click', 'aria/Guardar[role="button"]'],
      ['esperar', 600],
    ],
  },
  {
    id: 'tc28-constructor-con-cambios',
    ruta: '/admin/perfiles/{id:ejemplo-backend}',
    sesion: true,
    esperar: 'Slug',
    pasos: [
      ['type', '#slug', 'ejemplo-backend-vacante'],
      ['click', 'aria/Skills[role="link"]'],
      ['esperarTexto', 'cambios sin guardar'],
      ['esperar', 500],
    ],
  },
  {
    id: 'tc29-portada-con-cambios',
    ruta: '/admin/portada',
    sesion: true,
    esperar: 'Identidad y contacto',
    pasos: [
      ['type', '#fullName', 'Alex Rivera Duarte x'],
      ['click', 'aria/Skills[role="link"]'],
      ['esperarTexto', 'cambios sin guardar'],
      ['esperar', 500],
    ],
  },
  {
    id: 'tc30-dialogo-con-cambios',
    ruta: '/admin/experiencias',
    sesion: true,
    esperar: 'Cobalto Ejemplo',
    pasos: [
      ['click', 'aria/Editar Cobalto Ejemplo'],
      ['esperarTexto', 'Logros (en)'],
      ['type', '#company', ' '],
      ['click', 'aria/Cancelar[role="button"]'],
      ['esperarTexto', 'cambios sin guardar'],
      ['esperar', 500],
    ],
  },
];

// ── Utilidades ────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(code, message) {
  console.error(message);
  process.exit(code);
}

// Guarda 1: base descartable. Las cargas públicas registran visitas (ProfileView).
if (process.env.MANUAL_CAPTURE_DISPOSABLE_DB !== '1') {
  fail(
    2,
    [
      'manual:capture se niega a correr: cada página pública que abre registra una visita en la base.',
      'Definí MANUAL_CAPTURE_DISPOSABLE_DB=1 solo si la API apunta a la BASE DE EJEMPLO descartable',
      '(npm run seed:example sobre portfolio_example), nunca a la base del owner.',
    ].join('\n'),
  );
}

// Guarda 2: la API sirve el archivo de ejemplo, antes de abrir ninguna página.
const exampleName = JSON.parse(readFileSync(EXAMPLE, 'utf8')).profile.fullName;
let servedName;
try {
  const response = await fetch(`${base}/api/profile`);
  servedName = response.ok ? (await response.json()).fullName : `(HTTP ${response.status})`;
} catch (error) {
  fail(2, `No pude consultar ${base}/api/profile: ${error.message}`);
}
if (servedName !== exampleName) {
  fail(
    2,
    [
      `La API de ${base} sirve el perfil "${servedName}", no el del archivo de ejemplo ("${exampleName}").`,
      'No se abrió ninguna página ni se registró ninguna visita.',
    ].join('\n'),
  );
}

const adminEmail = process.env.MANUAL_CAPTURE_ADMIN_EMAIL;
const adminPassword = process.env.MANUAL_CAPTURE_ADMIN_PASSWORD;
const selected = MANIFEST.filter((entry) => !only || only.has(entry.id));
if (only) {
  const unknown = [...only].filter((id) => !MANIFEST.some((entry) => entry.id === id));
  if (unknown.length > 0) fail(1, `Ids que no están en el manifiesto: ${unknown.join(', ')}`);
}
if (selected.some((entry) => entry.sesion) && (!adminEmail || !adminPassword)) {
  fail(
    1,
    'Las capturas del panel necesitan MANUAL_CAPTURE_ADMIN_EMAIL y MANUAL_CAPTURE_ADMIN_PASSWORD (administrador de prueba de la base de ejemplo).',
  );
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: findChrome(),
  args: chromeFlags(),
  headless: true,
});

/** Contexto con la sesión del panel: se abre una sola vez (el login tiene límite de peticiones). */
let adminContext = null;

/** Una página nueva por captura, con movimiento reducido. Las públicas van en un contexto limpio. */
async function openPage(entry) {
  let context;
  if (entry.sesion) {
    adminContext ??= await browser.createBrowserContext();
    context = adminContext;
  } else {
    context = await browser.createBrowserContext();
  }
  const page = await context.newPage();
  await page.setViewport(VIEWPORTS[entry.viewport ?? 'desktop']);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  page.setDefaultTimeout(15000);
  return { page, context: entry.sesion ? null : context };
}

/** Abre el panel con `fetch('/api/auth/login')` desde la página: la contraseña nunca va a un campo. */
async function loginInto(page) {
  await page.goto(`${base}/admin/login`, { waitUntil: 'networkidle0' });
  const status = await page.evaluate(
    async (email, password) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });
      return response.status;
    },
    adminEmail,
    adminPassword,
  );
  if (status !== 200 && status !== 201) fail(1, `El login del panel respondió ${status}.`);
}

/** Ids de los perfiles curados por slug (lectura con la sesión abierta). */
async function profileIds(page) {
  const list = await page.evaluate(async () => {
    const response = await fetch('/api/admin/curated-profiles', { credentials: 'same-origin' });
    return response.json();
  });
  return Object.fromEntries(list.map((profile) => [profile.slug, profile.id]));
}

/** Etiqueta y portal del enlace de ejemplo que muestra TC-41 (el único dato que el script escribe). */
const EXAMPLE_LINK = { label: 'Cobalto — Laura, RR. HH.', portal: 'linkedin' };

/** Crea el enlace de ejemplo por la API del panel si el perfil todavía no lo tiene (idempotente). */
async function ensureExampleLink(page, profileId) {
  await page.evaluate(
    async (id, example) => {
      const url = `/api/admin/curated-profiles/${id}/share-links`;
      const links = await (await fetch(url, { credentials: 'same-origin' })).json();
      if (links.some((link) => link.label === example.label)) return;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(example),
      });
      if (!response.ok) throw new Error(`No pude crear el enlace de ejemplo: ${response.status}`);
    },
    profileId,
    EXAMPLE_LINK,
  );
}

async function waitForText(page, ...candidates) {
  await page.waitForFunction(
    (texts) => texts.some((t) => document.body.innerText.includes(t)),
    {},
    candidates,
  );
}

async function settle(page) {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.addStyleTag({ content: '* { caret-color: transparent !important; }' });
  // Recorre la página para terminar las animaciones de entrada por scroll y vuelve arriba.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(350);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(450);
}

async function runStep(page, step) {
  const [kind, a, b] = step;
  if (kind === 'click') await page.locator(a).click();
  else if (kind === 'type') await page.locator(a).fill(b);
  else if (kind === 'borrarYEscribir') await page.locator(a).fill(b);
  else if (kind === 'tecla') await page.keyboard.press(a);
  else if (kind === 'esperar') await sleep(a);
  else if (kind === 'esperarTexto') await waitForText(page, ...step.slice(1));
  else if (kind === 'verEnlaces') {
    // Desplaza hasta el bloque de enlaces de seguimiento para que entre en la captura.
    await page.evaluate(() => {
      document.querySelector('#enlaces-seguimiento')?.scrollIntoView({ block: 'start' });
    });
  } else if (kind === 'verSeccion') {
    // Desplaza hasta la sección indicada (selector CSS) para que entre en la captura.
    await page.evaluate((selector) => {
      document.querySelector(selector)?.scrollIntoView({ block: 'center' });
    }, a);
  } else if (kind === 'verTexto') {
    // Desplaza hasta el primer elemento que contiene el texto (para que entre en la captura).
    await page.evaluate((text) => {
      const el = [...document.querySelectorAll('[role="status"]')].find((n) => n.textContent.includes(text));
      el?.scrollIntoView({ block: 'center' });
    }, a);
  }
  else throw new Error(`Paso desconocido: ${kind}`);
}

let ids = null;
let loggedIn = false;
const results = [];

for (const entry of selected) {
  const { page, context } = await openPage(entry);
  try {
    if (entry.sesion && !loggedIn) {
      await loginInto(page);
      loggedIn = true;
    }
    if (entry.sesion) ids ??= await profileIds(page);
    const route = entry.ruta.replace(/\{id:([^}]+)\}/g, (_m, slug) => {
      if (!ids?.[slug]) throw new Error(`No existe el perfil ${slug} en la base de ejemplo`);
      return ids[slug];
    });
    await page.goto(`${base}${route}`, { waitUntil: 'networkidle0' });
    if (entry.preparar === 'enlace-de-ejemplo') {
      // El `fetch` relativo necesita el origen de la página: se crea acá y se recarga para verlo.
      await ensureExampleLink(page, ids['ejemplo-backend']);
      await page.reload({ waitUntil: 'networkidle0' });
    }
    if (entry.esperar) await waitForText(page, entry.esperar);
    if (entry.impresion) await page.emulateMediaType('print');
    await settle(page);
    for (const step of entry.pasos ?? []) await runStep(page, step);
    const file = join(OUT_DIR, `${entry.id}.jpg`);
    const fullPage = entry.recorte?.fullPage === true;
    // `altoMax` recorta una página muy larga: el tope de 150 KB por imagen manda.
    const clip = entry.recorte?.altoMax
      ? { x: 0, y: 0, width: VIEWPORTS[entry.viewport ?? 'desktop'].width, height: entry.recorte.altoMax }
      : undefined;
    await page.screenshot({
      path: file,
      type: 'jpeg',
      quality: JPEG_QUALITY,
      ...(clip ? { clip } : { fullPage }),
    });
    const size = statSync(file).size;
    results.push({ id: entry.id, size });
    console.log(`${size > MAX_BYTES ? '!!' : 'ok'} ${entry.id}.jpg  ${(size / 1024).toFixed(1)} KB`);
  } catch (error) {
    console.error(`FALLA ${entry.id}: ${error.message}`);
    results.push({ id: entry.id, error: error.message });
  } finally {
    await page.close();
    if (context) await context.close();
  }
}

await browser.close();
const failed = results.filter((r) => r.error);
const heavy = results.filter((r) => r.size > MAX_BYTES);
console.log(`\n${results.length - failed.length}/${results.length} capturas; ${heavy.length} sobre 150 KB.`);
process.exit(failed.length > 0 ? 1 : 0);

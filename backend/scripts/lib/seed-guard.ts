/**
 * Negativa a cargar un archivo alternativo (`--file`) sobre una base que no es descartable
 * (change `add-learning-guide-and-example-data`, D6). Tres capas, todas antes de cualquier
 * `deleteMany`:
 *
 *   1. `SEED_DISPOSABLE_DB=1` (mismo criterio que `PRINT_CHECK_DISPOSABLE_DB`).
 *   2. `NODE_ENV` distinto de `production`.
 *   3. La base no tiene filas de `Profile`, o su único `Profile` tiene el `fullName` del archivo.
 *
 * La evaluación es pura; solo `loadExistingProfileNames` consulta la base (lectura).
 */
import type { PrismaClient } from '@prisma/client';

export const SEED_GUARD_EXIT_CODE = 2;

export interface SeedGuardInput {
  env: Readonly<Record<string, string | undefined>>;
  /** Nombres de los `Profile` que ya hay en la base; `null` si no se consultó. */
  existingProfileNames: readonly string[] | null;
  /** `fullName` del archivo que se quiere cargar. */
  incomingFullName: string;
}

export interface SeedGuardFailure {
  layer: 1 | 2 | 3;
  message: string;
}

/** Muestra `host:puerto/base` de una `DATABASE_URL`, sin usuario ni contraseña. */
export function describeDatabaseTarget(databaseUrl: string | undefined): string {
  if (!databaseUrl) return '(DATABASE_URL sin definir)';
  try {
    const url = new URL(databaseUrl);
    const port = url.port !== '' ? url.port : '5432';
    return `${url.hostname}:${port}${url.pathname}`;
  } catch {
    return '(DATABASE_URL ilegible)';
  }
}

/** Capas 1 y 2: no necesitan la base. */
export function evaluateEnvLayers(env: SeedGuardInput['env']): SeedGuardFailure[] {
  const failures: SeedGuardFailure[] = [];
  if (env['SEED_DISPOSABLE_DB'] !== '1') {
    failures.push({
      layer: 1,
      message: 'falta SEED_DISPOSABLE_DB=1: confirma que la base de destino es descartable.',
    });
  }
  if (env['NODE_ENV'] === 'production') {
    failures.push({
      layer: 2,
      message: 'NODE_ENV=production: un archivo alternativo nunca se carga en producción.',
    });
  }
  return failures;
}

/** Capa 3: de quién son los datos que hay en la base. */
export function evaluateContentLayer(
  existingProfileNames: readonly string[],
  incomingFullName: string,
): SeedGuardFailure | null {
  if (existingProfileNames.length === 0) return null;
  if (existingProfileNames.length === 1 && existingProfileNames[0] === incomingFullName)
    return null;
  return {
    layer: 3,
    message:
      'la base ya tiene el contenido de otro perfil (no está vacía ni es una recarga del mismo archivo).',
  };
}

export function evaluateSeedGuard(input: SeedGuardInput): SeedGuardFailure[] {
  const failures = evaluateEnvLayers(input.env);
  if (input.existingProfileNames !== null) {
    const content = evaluateContentLayer(input.existingProfileNames, input.incomingFullName);
    if (content) failures.push(content);
  }
  return failures;
}

export function formatGuardFailure(failures: readonly SeedGuardFailure[], target: string): string {
  const lines = failures.map((f) => `  - capa ${f.layer}: ${f.message}`);
  return [
    `Negativa: no se carga el archivo alternativo en ${target}.`,
    ...lines,
    'Creá una base aparte (por ejemplo `portfolio_example`), aplicá las migraciones y apuntá',
    '`DATABASE_URL` a ella antes de correr el seed (ver docs/DATA-POPULATION.md).',
    'No se escribió nada.',
  ].join('\n');
}

export async function loadExistingProfileNames(prisma: PrismaClient): Promise<string[]> {
  const rows = await prisma.profile.findMany({ select: { fullName: true } });
  return rows.map((r) => r.fullName);
}

// ── Negativa del seed por defecto (change `protect-default-seed`) ─────────────────────────────
//
// Sin `--file`, el seed cuenta las filas de las tablas que limpia antes de escribir. Base vacía:
// carga. Con contenido: negativa (código 2) salvo `--overwrite`, y en producción además
// `SEED_ALLOW_PRODUCTION=1`. Toda la evaluación es pura; solo `loadContentCounts` lee la base.

export interface ContentTable {
  /** Modelo de Prisma, en el mismo orden que los `deleteMany` de `writeSeed`. */
  model: string;
  /** Etiqueta del mensaje (como en `seed:verify`). */
  label: string;
  count: (prisma: PrismaClient) => Promise<number>;
}

/** Las 13 tablas que el seed limpia, en el orden de sus `deleteMany` (D1). `AdminUser` no cuenta. */
export const SEED_CONTENT_TABLES: readonly ContentTable[] = [
  { model: 'profileView', label: 'ProfileView', count: (p) => p.profileView.count() },
  { model: 'curatedProfile', label: 'CuratedProfile', count: (p) => p.curatedProfile.count() },
  { model: 'theme', label: 'Theme', count: (p) => p.theme.count() },
  { model: 'skill', label: 'Skill', count: (p) => p.skill.count() },
  { model: 'skillCategory', label: 'SkillCategory', count: (p) => p.skillCategory.count() },
  { model: 'experience', label: 'Experience', count: (p) => p.experience.count() },
  { model: 'language', label: 'Language', count: (p) => p.language.count() },
  { model: 'profile', label: 'Profile', count: (p) => p.profile.count() },
  { model: 'education', label: 'Education', count: (p) => p.education.count() },
  { model: 'certification', label: 'Certification', count: (p) => p.certification.count() },
  { model: 'project', label: 'Project', count: (p) => p.project.count() },
  { model: 'socialLink', label: 'SocialLink', count: (p) => p.socialLink.count() },
  {
    model: 'featuredRepository',
    label: 'FeaturedRepository',
    count: (p) => p.featuredRepository.count(),
  },
];

export interface ContentCount {
  label: string;
  rows: number;
}

/** Cuenta las tablas en secuencia (orden fijo). Si una consulta falla, la excepción sube. */
export async function loadContentCounts(prisma: PrismaClient): Promise<ContentCount[]> {
  const counts: ContentCount[] = [];
  for (const table of SEED_CONTENT_TABLES) {
    counts.push({ label: table.label, rows: await table.count(prisma) });
  }
  return counts;
}

export type DefaultSeedRefusalReason =
  'content' | 'production-needs-overwrite' | 'production-needs-allow';

export type DefaultSeedDecision =
  | { action: 'load' }
  | { action: 'load-overwrite'; production: boolean }
  | { action: 'refuse'; reason: DefaultSeedRefusalReason };

export interface DefaultSeedInput {
  counts: readonly ContentCount[];
  overwrite: boolean;
  env: Readonly<Record<string, string | undefined>>;
}

/** Decisión de D3 y de la tabla de D4. */
export function evaluateDefaultSeed(input: DefaultSeedInput): DefaultSeedDecision {
  if (!input.counts.some((c) => c.rows > 0)) return { action: 'load' };

  const production = input.env['NODE_ENV'] === 'production';
  if (!input.overwrite) {
    return { action: 'refuse', reason: production ? 'production-needs-overwrite' : 'content' };
  }
  if (production && input.env['SEED_ALLOW_PRODUCTION'] !== '1') {
    return { action: 'refuse', reason: 'production-needs-allow' };
  }
  return { action: 'load-overwrite', production };
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Comando `pg_dump` sugerido para el destino, sin contraseña (D8). Devuelve las líneas ya
 * listas para imprimir bajo el encabezado de la negativa.
 */
export function describePgDumpCommand(databaseUrl: string | undefined, now: Date): string[] {
  const generic = ['  Respaldá la base con pg_dump antes de seguir (ver docs/DEPLOY.md § 7).'];
  if (!databaseUrl) return generic;
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return generic;
  }
  if (url.hostname === '') return generic;

  const base = url.pathname.replace(/^\/+/, '');
  const port = url.port !== '' ? url.port : '5432';
  const user = url.username !== '' ? `${url.username}@` : '';
  const sslmode = url.searchParams.get('sslmode');
  const query = sslmode ? `?sslmode=${encodeURIComponent(sslmode)}` : '';
  const uri = `postgresql://${user}${url.hostname}:${port}/${base}${query}`;
  const date = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const lines = [`  pg_dump "${uri}" -Fc -f ${base === '' ? 'portfolio' : base}-${date}.dump`];
  if (url.hostname.endsWith('.railway.internal')) {
    lines.push(
      'Esa dirección es la red privada de Railway: desde tu máquina usá DATABASE_PUBLIC_URL del servicio Postgres (docs/DEPLOY-RAILWAY.md, paso 4).',
    );
  }
  return lines;
}

const withRows = (counts: readonly ContentCount[]): ContentCount[] =>
  counts.filter((c) => c.rows > 0);

export interface DefaultSeedRefusalInput {
  reason: DefaultSeedRefusalReason;
  target: string;
  counts: readonly ContentCount[];
  databaseUrl: string | undefined;
  now: Date;
}

/** Texto de la negativa (D8), con la misma forma que `formatGuardFailure`. */
export function formatDefaultSeedRefusal(input: DefaultSeedRefusalInput): string {
  const production = input.reason !== 'content';
  const header = `Negativa: no se recarga docs/cv-data.json en ${input.target}: la base ya tiene contenido${
    production ? ' (NODE_ENV=production)' : ''
  }.`;
  const how =
    input.reason === 'content'
      ? 'Para borrarlo y recargar desde docs/cv-data.json: npm run seed -- --overwrite'
      : input.reason === 'production-needs-overwrite'
        ? 'Para borrarlo y recargar en producción hacen falta las dos llaves: SEED_ALLOW_PRODUCTION=1, definida solo para este comando, y npm run seed -- --overwrite'
        : '--overwrite no alcanza con NODE_ENV=production: falta SEED_ALLOW_PRODUCTION=1, definida solo para este comando (nunca como variable del servicio).';
  return [
    header,
    ...withRows(input.counts).map((c) => `  - ${c.label}: ${c.rows}`),
    'Si querés conservarlo, respaldalo antes (pg_dump pide la contraseña):',
    ...describePgDumpCommand(input.databaseUrl, input.now),
    how,
    'No se escribió nada.',
  ].join('\n');
}

/** Aviso previo a una recarga forzada (D3 y D4). */
export function formatOverwriteWarning(
  target: string,
  counts: readonly ContentCount[],
  production: boolean,
): string {
  const detail = withRows(counts)
    .map((c) => `${c.label}: ${c.rows}`)
    .join(', ');
  const prefix = production ? '--overwrite en producción (SEED_ALLOW_PRODUCTION=1)' : '--overwrite';
  return `⚠️  ${prefix}: se borra el contenido de ${target} (${detail}).`;
}

/**
 * Formas en que la contraseña de la URL puede aparecer en un mensaje: tal como está en la URL
 * (codificada, que es lo que devuelve `URL.password`) y decodificada.
 */
function passwordForms(databaseUrl: string | undefined): string[] {
  if (!databaseUrl) return [];
  let encoded: string;
  try {
    encoded = new URL(databaseUrl).password;
  } catch {
    return []; // URL ilegible: no hay contraseña que quitar.
  }
  if (encoded === '') return [];
  let decoded = encoded;
  try {
    decoded = decodeURIComponent(encoded);
  } catch {
    // Codificación inválida: queda solo la forma literal.
  }
  // La más larga primero, para no dejar restos si una contiene a la otra.
  return [...new Set([encoded, decoded])].sort((a, b) => b.length - a.length);
}

/** Falla al contar (D6). Quita la contraseña de la URL, codificada o no, si el error la arrastrara. */
export function formatCountFailure(
  target: string,
  cause: unknown,
  databaseUrl: string | undefined,
): string {
  let message = cause instanceof Error ? cause.message : String(cause);
  for (const form of passwordForms(databaseUrl)) message = message.split(form).join('***');
  return [
    `❌ No se pudo comprobar si ${target} tiene contenido: ${message}`,
    '¿Aplicaste las migraciones? (npm run prisma:deploy)',
    'No se escribió nada.',
  ].join('\n');
}

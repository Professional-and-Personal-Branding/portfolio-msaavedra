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

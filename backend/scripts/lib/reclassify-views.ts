/**
 * Lógica de `npm run views:reclassify` (change `classify-profile-views`, D4 y D5).
 * Recalcula el `kind` de las visitas con la MISMA función que usa el registro
 * (`classifyUserAgent`) y el `views` de cada perfil como la cantidad de sus visitas
 * `HUMAN`. Todo lo que no escribe es puro y se prueba sin base.
 */
import { PrismaClient } from '@prisma/client';
import {
  BOT_USER_AGENT_PATTERNS_VERSION,
  classifyUserAgent,
} from '../../src/modules/analytics/domain/services/classify-user-agent';
import { VIEW_KINDS, ViewKind } from '../../src/modules/analytics/domain/view-kind';
import { describePgDumpCommand } from './seed-guard';

/** Tamaño de los lotes de lectura y de `updateMany`. */
export const RECLASSIFY_BATCH_SIZE = 1000;

export interface ReclassifyArgs {
  readonly apply: boolean;
}

export type ParsedReclassifyArgs =
  { ok: true; value: ReclassifyArgs } | { ok: false; error: string };

/** Solo acepta `--apply`; cualquier otro argumento es un error de uso (código 1). */
export function parseReclassifyArgs(argv: readonly string[]): ParsedReclassifyArgs {
  let apply = false;
  for (const arg of argv) {
    if (arg === '--apply') apply = true;
    else
      return {
        ok: false,
        error: `Argumento desconocido: ${arg}. Uso: npm run views:reclassify [-- --apply]`,
      };
  }
  return { ok: true, value: { apply } };
}

export interface ViewRow {
  readonly id: string;
  readonly curatedProfileId: string;
  readonly userAgent: string | null;
  readonly kind: ViewKind;
}

export interface ProfileRow {
  readonly id: string;
  readonly slug: string;
  readonly views: number;
}

export interface ProfileViewsChange {
  readonly id: string;
  readonly slug: string;
  readonly current: number;
  readonly expected: number;
}

export type KindCounts = Record<ViewKind, number>;

export interface ReclassificationPlan {
  readonly rows: number;
  /** Ids que pasan de HUMAN a BOT. */
  readonly toBot: readonly string[];
  /** Ids que pasan de BOT a HUMAN (la lista se achicó). */
  readonly toHuman: readonly string[];
  readonly before: KindCounts;
  readonly after: KindCounts;
  readonly profileChanges: readonly ProfileViewsChange[];
  readonly hasChanges: boolean;
}

const emptyCounts = (): KindCounts => ({ HUMAN: 0, OWNER: 0, BOT: 0 });

/**
 * Plan puro. Las filas `OWNER` no se tocan jamás (no hay dato que permita
 * reclasificarlas); las demás toman `classifyUserAgent(userAgent)`. `views` esperado =
 * cantidad de filas `HUMAN` resultantes del perfil.
 */
export function planReclassification(
  rows: readonly ViewRow[],
  profiles: readonly ProfileRow[],
): ReclassificationPlan {
  const before = emptyCounts();
  const after = emptyCounts();
  const toBot: string[] = [];
  const toHuman: string[] = [];
  const humanByProfile = new Map<string, number>();

  for (const row of rows) {
    before[row.kind] += 1;
    const next: ViewKind = row.kind === 'OWNER' ? 'OWNER' : classifyUserAgent(row.userAgent);
    after[next] += 1;
    if (row.kind === 'HUMAN' && next === 'BOT') toBot.push(row.id);
    if (row.kind === 'BOT' && next === 'HUMAN') toHuman.push(row.id);
    if (next === 'HUMAN') {
      humanByProfile.set(row.curatedProfileId, (humanByProfile.get(row.curatedProfileId) ?? 0) + 1);
    }
  }

  const profileChanges = profiles
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      current: p.views,
      expected: humanByProfile.get(p.id) ?? 0,
    }))
    .filter((p) => p.current !== p.expected)
    .sort((a, b) => a.slug.localeCompare(b.slug));

  return {
    rows: rows.length,
    toBot,
    toHuman,
    before,
    after,
    profileChanges,
    hasChanges: toBot.length > 0 || toHuman.length > 0 || profileChanges.length > 0,
  };
}

const formatCounts = (counts: KindCounts): string =>
  VIEW_KINDS.map((kind) => `${kind} ${counts[kind]}`).join(' · ');

export interface ReportInput {
  readonly plan: ReclassificationPlan;
  /** `host:puerto/base` sin credenciales (`describeDatabaseTarget`). */
  readonly target: string;
  readonly apply: boolean;
  readonly databaseUrl?: string;
  readonly now?: Date;
}

/** Informe de texto. Nunca incluye usuario ni contraseña de la `DATABASE_URL`. */
export function formatReclassificationReport(input: ReportInput): string {
  const { plan, target, apply } = input;
  const lines = [
    `views:reclassify — lista de bots v${BOT_USER_AGENT_PATTERNS_VERSION}`,
    `Destino: ${target}`,
    `Modo: ${apply ? 'APLICAR' : 'simulación (no escribe; usá --apply para aplicar)'}`,
    '',
    `Visitas: ${plan.rows}`,
    `Antes:   ${formatCounts(plan.before)}`,
    `Después: ${formatCounts(plan.after)}`,
    `Cambian de kind: HUMAN → BOT ${plan.toBot.length} · BOT → HUMAN ${plan.toHuman.length}`,
  ];
  if (plan.profileChanges.length === 0) {
    lines.push('Visitas de cada perfil (views): sin diferencias.');
  } else {
    lines.push('Visitas de cada perfil (views), actual → nuevo:');
    for (const c of plan.profileChanges) {
      lines.push(
        `  ${c.slug}: ${c.current} → ${c.expected} (${c.expected - c.current >= 0 ? '+' : ''}${c.expected - c.current})`,
      );
    }
  }
  if (!plan.hasChanges) {
    lines.push('', 'Sin cambios: la base ya está reclasificada.');
  } else {
    lines.push(
      '',
      'Antes de aplicar en una base con datos que importen, respaldala (sin contraseña en la línea de comandos):',
      ...describePgDumpCommand(input.databaseUrl, input.now ?? new Date()),
    );
  }
  return lines.join('\n');
}

/** Lee todas las visitas en lotes por `id`. */
export async function loadViewRows(prisma: PrismaClient): Promise<ViewRow[]> {
  const rows: ViewRow[] = [];
  let cursor: string | undefined;
  for (;;) {
    const batch = await prisma.profileView.findMany({
      select: { id: true, curatedProfileId: true, userAgent: true, kind: true },
      orderBy: { id: 'asc' },
      take: RECLASSIFY_BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    rows.push(...batch);
    if (batch.length < RECLASSIFY_BATCH_SIZE) return rows;
    cursor = batch[batch.length - 1].id;
  }
}

export async function loadProfileRows(prisma: PrismaClient): Promise<ProfileRow[]> {
  return prisma.curatedProfile.findMany({ select: { id: true, slug: true, views: true } });
}

const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/** Escribe el plan en UNA transacción: cambios de `kind` por lotes y `views` por perfil. */
export async function applyReclassification(
  prisma: PrismaClient,
  plan: ReclassificationPlan,
): Promise<void> {
  if (!plan.hasChanges) return;
  await prisma.$transaction(
    async (tx) => {
      for (const ids of chunk(plan.toBot, RECLASSIFY_BATCH_SIZE)) {
        await tx.profileView.updateMany({ where: { id: { in: ids } }, data: { kind: 'BOT' } });
      }
      for (const ids of chunk(plan.toHuman, RECLASSIFY_BATCH_SIZE)) {
        await tx.profileView.updateMany({ where: { id: { in: ids } }, data: { kind: 'HUMAN' } });
      }
      for (const change of plan.profileChanges) {
        // SQL crudo (change polish-views-updated-at-and-builder, D2): corregir `views` no es editar el
        // perfil, y `update` rellenaría `@updatedAt` y movería el `<lastmod>` del sitemap.
        await tx.$executeRaw`UPDATE "CuratedProfile" SET "views" = ${change.expected} WHERE "id" = ${change.id}`;
      }
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
}

import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { IntegrationJob as JobRow, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import { IntegrationJob } from '../../domain/entities/integration-job.entity';
import {
  EnqueueJobInput,
  EnqueueJobResult,
  IntegrationJobRepository,
  JobSummary,
  PurgeResult,
} from '../../domain/repositories/integration-job.repository';

const DAY_MS = 86_400_000;
const NOW_UTC = Prisma.sql`(now() AT TIME ZONE 'UTC')`;

function toPayload(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}

/** Fila de Prisma (o del `RETURNING *` crudo) → entidad. */
export function toIntegrationJob(row: JobRow): IntegrationJob {
  return new IntegrationJob({
    id: row.id,
    provider: row.provider,
    kind: row.kind,
    idempotencyKey: row.idempotencyKey,
    payload: toPayload(row.payload),
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    runAt: row.runAt,
    lockedBy: row.lockedBy,
    lockedUntil: row.lockedUntil,
    lastErrorClass: row.lastErrorClass,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    finishedAt: row.finishedAt,
  });
}

/**
 * Cola de trabajos sobre Postgres (D4, D7). El encolado y el reclamo son SQL crudo: `ON CONFLICT
 * DO NOTHING` para la idempotencia y `FOR UPDATE SKIP LOCKED` para que dos ejecutores no
 * reclamen la misma fila. Todas las sentencias son de una sola consulta: ninguna retiene una
 * conexión del pool mientras se espera a un tercero.
 */
@Injectable()
export class PrismaIntegrationJobRepository implements IntegrationJobRepository {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(input: EnqueueJobInput): Promise<EnqueueJobResult> {
    const payload = JSON.stringify(input.payload);
    const inserted = await this.prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO "IntegrationJob"
        ("id", "provider", "kind", "idempotencyKey", "payload", "status", "attempts", "maxAttempts",
         "runAt", "createdAt", "updatedAt")
      VALUES
        (${randomUUID()}, ${input.provider}, ${input.kind}, ${input.idempotencyKey},
         ${payload}::jsonb, 'PENDING', 0, ${input.maxAttempts ?? 8}, ${input.runAt},
         ${NOW_UTC}, ${NOW_UTC})
      ON CONFLICT DO NOTHING
      RETURNING "id"`;
    // Sin objetivo de conflicto: cubre la clave de idempotencia y el índice único parcial «un trabajo
    // activo por proveedor y tipo» (M4). Si chocó, se devuelve el existente.
    const existing =
      (await this.prisma.integrationJob.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      })) ??
      (await this.prisma.integrationJob.findFirst({
        where: {
          provider: input.provider,
          kind: input.kind,
          status: { in: ['PENDING', 'RUNNING', 'FAILED'] },
        },
        orderBy: { createdAt: 'asc' },
      }));
    if (!existing) throw new Error('No se pudo encolar ni encontrar el trabajo existente');
    return { job: toIntegrationJob(existing), created: inserted.length > 0 };
  }

  async findActiveByProvider(provider: string): Promise<IntegrationJob | null> {
    const row = await this.prisma.integrationJob.findFirst({
      where: { provider, status: { in: ['PENDING', 'RUNNING', 'FAILED'] } },
      orderBy: [{ runAt: 'asc' }, { createdAt: 'asc' }],
    });
    return row ? toIntegrationJob(row) : null;
  }

  async claimNext(
    providers: readonly string[],
    lockMs: number,
    holder: string,
  ): Promise<IntegrationJob | null> {
    if (providers.length === 0) return null;
    const rows = await this.prisma.$queryRaw<JobRow[]>`
      UPDATE "IntegrationJob"
         SET "status" = 'RUNNING',
             "lockedBy" = ${holder},
             "lockedUntil" = ${NOW_UTC} + (${lockMs}::double precision / 1000) * interval '1 second',
             "attempts" = "attempts" + 1,
             "updatedAt" = ${NOW_UTC}
       WHERE "id" = (
         SELECT "id" FROM "IntegrationJob"
          WHERE "status" IN ('PENDING', 'FAILED')
            AND "runAt" <= ${NOW_UTC}
            AND "provider" = ANY(${[...providers]}::text[])
          ORDER BY "runAt", "createdAt"
          FOR UPDATE SKIP LOCKED
          LIMIT 1)
      RETURNING *`;
    return rows.length > 0 ? toIntegrationJob(rows[0]) : null;
  }

  async listExpiredLocks(limit: number): Promise<IntegrationJob[]> {
    const rows = await this.prisma.integrationJob.findMany({
      where: { status: 'RUNNING', lockedUntil: { lt: new Date() } },
      orderBy: { lockedUntil: 'asc' },
      take: limit,
    });
    return rows.map(toIntegrationJob);
  }

  async save(job: IntegrationJob, expectedLockedBy: string | null): Promise<boolean> {
    const p = job.props;
    const result = await this.prisma.integrationJob.updateMany({
      where: { id: p.id, status: 'RUNNING', lockedBy: expectedLockedBy },
      data: {
        status: p.status,
        attempts: p.attempts,
        runAt: p.runAt,
        lockedBy: p.lockedBy,
        lockedUntil: p.lockedUntil,
        lastErrorClass: p.lastErrorClass,
        lastError: p.lastError,
        finishedAt: p.finishedAt,
        updatedAt: p.updatedAt,
      },
    });
    return result.count === 1;
  }

  async summarize(providers: readonly string[]): Promise<ReadonlyMap<string, JobSummary>> {
    const [groups, dead] = await Promise.all([
      this.prisma.integrationJob.groupBy({
        by: ['provider', 'status'],
        where: { provider: { in: [...providers] } },
        _count: { _all: true },
      }),
      this.prisma.integrationJob.findMany({
        where: { provider: { in: [...providers] }, status: 'DEAD' },
        orderBy: { updatedAt: 'desc' },
        distinct: ['provider'],
        select: { provider: true, lastError: true },
      }),
    ]);
    const out = new Map<string, JobSummary>();
    for (const provider of providers) {
      const count = (status: string): number =>
        groups.find((g) => g.provider === provider && g.status === status)?._count._all ?? 0;
      out.set(provider, {
        counts: {
          pending: count('PENDING'),
          running: count('RUNNING'),
          failed: count('FAILED'),
          dead: count('DEAD'),
        },
        lastDeadError: dead.find((d) => d.provider === provider)?.lastError ?? null,
      });
    }
    return out;
  }

  async purge(
    now: Date,
    doneOlderThanDays: number,
    deadOlderThanDays: number,
  ): Promise<PurgeResult> {
    const doneCut = new Date(now.getTime() - doneOlderThanDays * DAY_MS);
    const deadCut = new Date(now.getTime() - deadOlderThanDays * DAY_MS);
    // Una sentencia por tabla; los SyncRun de un trabajo borrado caen en cascada.
    const jobs = await this.prisma.integrationJob.deleteMany({
      where: {
        OR: [
          { status: 'DONE', finishedAt: { lt: doneCut } },
          { status: 'DEAD', finishedAt: { lt: deadCut } },
        ],
      },
    });
    const runs = await this.prisma.syncRun.deleteMany({ where: { startedAt: { lt: deadCut } } });
    return { jobs: jobs.count, runs: runs.count };
  }
}

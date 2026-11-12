import { Injectable } from '@nestjs/common';
import { SyncRun as SyncRunRow } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import {
  FinishSyncRunInput,
  SyncRunRecord,
  SyncRunRepository,
} from '../../domain/repositories/sync-run.repository';

function toRecord(row: SyncRunRow): SyncRunRecord {
  return {
    id: row.id,
    jobId: row.jobId,
    provider: row.provider,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    outcome: row.outcome,
    errorClass: row.errorClass,
    errorMessage: row.errorMessage,
    itemsChanged: row.itemsChanged,
    durationMs: row.durationMs,
  };
}

@Injectable()
export class PrismaSyncRunRepository implements SyncRunRepository {
  constructor(private readonly prisma: PrismaService) {}

  async start(jobId: string, provider: string, startedAt: Date): Promise<string> {
    const row = await this.prisma.syncRun.create({
      data: { jobId, provider, startedAt },
      select: { id: true },
    });
    return row.id;
  }

  async finish(id: string, input: FinishSyncRunInput): Promise<void> {
    await this.prisma.syncRun.update({
      where: { id },
      data: {
        outcome: input.outcome,
        errorClass: input.errorClass ?? null,
        errorMessage: input.errorMessage ?? null,
        itemsChanged: input.itemsChanged ?? 0,
        finishedAt: input.finishedAt,
        durationMs: input.durationMs,
      },
    });
  }

  async latestByProvider(
    providers: readonly string[],
  ): Promise<ReadonlyMap<string, SyncRunRecord>> {
    const rows = await this.prisma.syncRun.findMany({
      where: { provider: { in: [...providers] } },
      orderBy: { startedAt: 'desc' },
      distinct: ['provider'],
    });
    return new Map(rows.map((row) => [row.provider, toRecord(row)]));
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import { SnapshotRecord, SnapshotRepository } from '../../domain/repositories/snapshot.repository';

@Injectable()
export class PrismaSnapshotRepository implements SnapshotRepository {
  constructor(private readonly prisma: PrismaService) {}

  async find(provider: string, resourceKey: string): Promise<SnapshotRecord | null> {
    const row = await this.prisma.externalSnapshot.findUnique({
      where: { provider_resourceKey: { provider, resourceKey } },
    });
    return row
      ? {
          provider: row.provider,
          resourceKey: row.resourceKey,
          etag: row.etag,
          contentHash: row.contentHash,
          body: row.body,
          fetchedAt: row.fetchedAt,
          changedAt: row.changedAt,
        }
      : null;
  }

  async replace(record: Omit<SnapshotRecord, 'fetchedAt' | 'changedAt'>, at: Date): Promise<void> {
    const body = record.body as Prisma.InputJsonValue;
    await this.prisma.externalSnapshot.upsert({
      where: {
        provider_resourceKey: { provider: record.provider, resourceKey: record.resourceKey },
      },
      create: {
        provider: record.provider,
        resourceKey: record.resourceKey,
        etag: record.etag,
        contentHash: record.contentHash,
        body,
        fetchedAt: at,
        changedAt: at,
      },
      update: {
        etag: record.etag,
        contentHash: record.contentHash,
        body,
        fetchedAt: at,
        changedAt: at,
      },
    });
  }

  async touch(
    provider: string,
    resourceKey: string,
    at: Date,
    etag?: string | null,
  ): Promise<void> {
    await this.prisma.externalSnapshot.updateMany({
      where: { provider, resourceKey },
      data: etag === undefined ? { fetchedAt: at } : { fetchedAt: at, etag },
    });
  }
}

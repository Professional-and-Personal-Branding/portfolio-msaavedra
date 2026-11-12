import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, Clock } from '../../../../shared/domain/clock';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { permanent, ProviderFailure } from '../../domain/provider-failure';
import {
  SNAPSHOT_REPOSITORY,
  SnapshotRepository,
} from '../../domain/repositories/snapshot.repository';
import { MAX_SNAPSHOT_BYTES, SnapshotStore, StoredSnapshot } from '../ports/snapshot-store.port';

/** JSON con las claves ordenadas: el mismo contenido da siempre el mismo hash. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/**
 * Caché de lo que se trajo de un tercero (D15): `ExternalSnapshot` por `(provider, resourceKey)`
 * con `etag` y hash del contenido, para mandar `If-None-Match` y saber si algo cambió.
 */
@Injectable()
export class SnapshotStoreService implements SnapshotStore {
  constructor(
    @Inject(SNAPSHOT_REPOSITORY) private readonly snapshots: SnapshotRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async get(provider: string, resourceKey: string): Promise<StoredSnapshot | null> {
    const found = await this.snapshots.find(provider, resourceKey);
    return found ? { etag: found.etag, body: found.body, fetchedAt: found.fetchedAt } : null;
  }

  async recordNotModified(provider: string, resourceKey: string, fetchedAt: Date): Promise<void> {
    await this.snapshots.touch(provider, resourceKey, fetchedAt);
  }

  async record(
    provider: string,
    resourceKey: string,
    snapshot: { etag?: string | null; body: unknown },
  ): Promise<Result<{ changed: boolean }, ProviderFailure>> {
    const serialized = canonicalJson(snapshot.body);
    if (Buffer.byteLength(serialized, 'utf-8') > MAX_SNAPSHOT_BYTES) {
      return fail(permanent('snapshot demasiado grande'));
    }
    const contentHash = createHash('sha256').update(serialized).digest('hex');
    const now = this.clock.now();
    const existing = await this.snapshots.find(provider, resourceKey);
    if (existing && existing.contentHash === contentHash) {
      await this.snapshots.touch(provider, resourceKey, now, snapshot.etag ?? existing.etag);
      return ok({ changed: false });
    }
    await this.snapshots.replace(
      { provider, resourceKey, etag: snapshot.etag ?? null, contentHash, body: snapshot.body },
      now,
    );
    return ok({ changed: true });
  }
}

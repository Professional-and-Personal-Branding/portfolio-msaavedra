export const SNAPSHOT_REPOSITORY = Symbol('SNAPSHOT_REPOSITORY');

export interface SnapshotRecord {
  readonly provider: string;
  readonly resourceKey: string;
  readonly etag: string | null;
  readonly contentHash: string;
  readonly body: unknown;
  readonly fetchedAt: Date;
  readonly changedAt: Date;
}

export interface SnapshotRepository {
  find(provider: string, resourceKey: string): Promise<SnapshotRecord | null>;
  /** Crea o reemplaza el snapshot (`changedAt` y `fetchedAt` = `at`). */
  replace(record: Omit<SnapshotRecord, 'fetchedAt' | 'changedAt'>, at: Date): Promise<void>;
  /** Mismo contenido: solo mueve `fetchedAt` y, si vino, `etag`. */
  touch(provider: string, resourceKey: string, at: Date, etag?: string | null): Promise<void>;
}

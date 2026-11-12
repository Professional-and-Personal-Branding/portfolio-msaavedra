import { Result } from '../../../../shared/domain/result';
import { ProviderFailure } from '../../domain/provider-failure';

export const SNAPSHOT_STORE = Symbol('SNAPSHOT_STORE');

/** Tope del cuerpo serializado de un snapshot (D15). */
export const MAX_SNAPSHOT_BYTES = 1024 * 1024;

export interface StoredSnapshot {
  readonly etag: string | null;
  readonly body: unknown;
  readonly fetchedAt: Date;
}

export interface SnapshotStore {
  /** Para mandar `If-None-Match`. */
  get(provider: string, resourceKey: string): Promise<StoredSnapshot | null>;
  /** Un 304: solo mueve `fetchedAt`. */
  recordNotModified(provider: string, resourceKey: string, fetchedAt: Date): Promise<void>;
  /**
   * Guarda el cuerpo. Con el mismo `contentHash` solo actualiza `fetchedAt` y `etag`
   * (`changed = false`). Un cuerpo de más de 1 MiB es `Permanent` y no escribe nada.
   */
  record(
    provider: string,
    resourceKey: string,
    snapshot: { etag?: string | null; body: unknown },
  ): Promise<Result<{ changed: boolean }, ProviderFailure>>;
}

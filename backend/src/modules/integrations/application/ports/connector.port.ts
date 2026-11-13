import { Result } from '../../../../shared/domain/result';
import { ProviderFailure } from '../../domain/provider-failure';
import { RunLogger } from './run-logger.port';
import { SnapshotStore } from './snapshot-store.port';

/** Lo que el conector recibe para sincronizar (D1). El secreto ya está resuelto (D14). */
export interface SyncContext {
  readonly jobId: string;
  readonly provider: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly secret: string;
  readonly snapshots: SnapshotStore;
  /** Logger hijo con `{ syncRunId, jobId, provider }` (D16). */
  readonly log: RunLogger;
}

export interface SyncOutcome {
  /** Cantidad de recursos que cambiaron respecto del snapshot anterior. */
  readonly itemsChanged: number;
}

/**
 * Puerto de un proveedor externo. El conector **devuelve** el fallo clasificado; si lanza, el
 * ejecutor lo trata como `Transient` con el mensaje redactado. Los conectores que usan `fetch`
 * tienen que pasarle `signal` (D5).
 */
export interface ConnectorPort {
  readonly id: string;
  readonly secretEnv: string | null;
  sync(ctx: SyncContext, signal: AbortSignal): Promise<Result<SyncOutcome, ProviderFailure>>;
}

export const CONNECTOR_REGISTRY = Symbol('CONNECTOR_REGISTRY');

/** Conectores habilitados por `INTEGRATIONS_ENABLED` (D1). */
export interface ConnectorRegistry {
  get(provider: string): ConnectorPort | undefined;
  ids(): readonly string[];
}

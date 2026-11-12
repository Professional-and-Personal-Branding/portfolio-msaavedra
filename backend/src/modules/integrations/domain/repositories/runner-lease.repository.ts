export const RUNNER_LEASE_REPOSITORY = Symbol('RUNNER_LEASE_REPOSITORY');

export interface RunnerLeaseRepository {
  /**
   * Toma o renueva el arriendo (D4): solo si venció o ya es de `holder`. `false` si otra
   * instancia lo tiene.
   */
  acquire(holder: string, ttlMs: number): Promise<boolean>;
  /** Libera el arriendo si sigue siendo de `holder`. */
  release(holder: string): Promise<void>;
}

export const INTEGRATIONS_SETTINGS = Symbol('INTEGRATIONS_SETTINGS');
/** Quién arrienda la corrida: `<hostname>:<pid>:<uuid del arranque>` (D4). */
export const RUNNER_HOLDER = Symbol('RUNNER_HOLDER');
/** Fuente de azar inyectable (jitter de los reintentos). */
export const RANDOM_SOURCE = Symbol('RANDOM_SOURCE');

/** Configuración de ejecución que necesitan los casos de uso (subconjunto de `IntegrationsConfig`). */
export interface IntegrationsSettings {
  readonly enabledProviders: readonly string[];
  readonly schedulerEnabled: boolean;
  readonly jobTimeoutMs: number;
  readonly runMaxMs: number;
}

/** Trabajos por corrida y gracias sobre los timeouts (D4, D5). */
export const MAX_JOBS_PER_RUN = 20;
export const LOCK_GRACE_MS = 30_000;
export const LEASE_GRACE_MS = 60_000;
/** Cuánto se espera a un conector que ignora la señal al apagar (D6). */
export const SHUTDOWN_GRACE_MS = 3000;

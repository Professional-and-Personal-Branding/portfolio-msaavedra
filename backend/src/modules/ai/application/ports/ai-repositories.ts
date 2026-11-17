import { AiRun } from '../../domain/ai-run.entity';

export const AI_RUN_REPOSITORY = Symbol('AiRunRepository');
export const AI_BUDGET_REPOSITORY = Symbol('AiBudgetRepository');

/** Corridas de IA: lectura y alta de las que nacen terminales (`CACHED`, `BLOCKED`, `FAILED`). */
export interface AiRunRepository {
  save(run: AiRun): Promise<void>;
  findSucceededByCacheKey(cacheKey: string): Promise<AiRun | null>;
  findById(id: string): Promise<AiRun | null>;
  listRecent(limit: number): Promise<AiRun[]>;
}

export interface BudgetMonthSnapshot {
  readonly month: string;
  readonly spentMicroUsd: number;
  readonly reservedMicroUsd: number;
  readonly providerBlockedUntil: Date | null;
  readonly providerBlockReason: string | null;
}

export type ReserveOutcome =
  | { readonly kind: 'granted' }
  | { readonly kind: 'exhausted' }
  | { readonly kind: 'providerBlocked'; readonly until: Date };

export interface ReserveRequest {
  /** Corrida `RESERVED` que se inserta junto con la reserva. */
  readonly run: AiRun;
  readonly month: string;
  readonly capMicroUsd: number;
  readonly now: Date;
}

export interface SettleRequest {
  /** La corrida ya cerrada (`SUCCEEDED`, `REFUSED`, `FAILED`). */
  readonly run: AiRun;
  readonly month: string;
  /** Lo que se libera del reservado (la reserva original). */
  readonly releasedMicroUsd: number;
  /** Lo que se imputa al gastado (costo real, 0 o la reserva entera). */
  readonly chargedMicroUsd: number;
}

/**
 * Contador del mes (D8). Cada operación que toca el contador y la corrida va en una sola
 * transacción: reservar inserta la corrida `RESERVED`, conciliar la cierra.
 */
export interface AiBudgetRepository {
  /**
   * Una única sentencia condicional sobre la fila del mes: reservas simultáneas, incluso de dos
   * instancias, no pueden sumar más que el tope.
   */
  reserve(request: ReserveRequest): Promise<ReserveOutcome>;
  /** Cierra la corrida y concilia el contador. `false` si ya no estaba `RESERVED` (la barrió el barrido). */
  settle(request: SettleRequest): Promise<boolean>;
  /**
   * Pasa a `ABANDONED` las `RESERVED` vencidas (de cualquier mes: cada una concilia el suyo),
   * imputando su reserva entera como gasto.
   */
  abandonExpired(now: Date): Promise<number>;
  blockProvider(month: string, until: Date, reason: string): Promise<void>;
  getMonth(month: string): Promise<BudgetMonthSnapshot | null>;
}

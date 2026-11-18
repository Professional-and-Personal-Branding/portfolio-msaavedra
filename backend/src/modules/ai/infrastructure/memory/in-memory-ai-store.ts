import {
  AiBudgetRepository,
  AiRunRepository,
  BudgetMonthSnapshot,
  ReserveOutcome,
  ReserveRequest,
  SettleRequest,
} from '../../application/ports/ai-repositories';
import { AiRun } from '../../domain/ai-run.entity';

export interface MonthRow {
  spent: number;
  reserved: number;
  blockedUntil: Date | null;
  blockReason: string | null;
}

/**
 * Repositorios en memoria con la misma semántica que el SQL: una reserva solo entra si cabe.
 * Los usan los tests y `npm run ai:eval` (presupuesto propio de la corrida, sin tocar la base).
 */
export class InMemoryAiStore implements AiRunRepository, AiBudgetRepository {
  readonly runs = new Map<string, AiRun>();
  readonly months = new Map<string, MonthRow>();

  private month(key: string): MonthRow {
    let row = this.months.get(key);
    if (!row) {
      row = { spent: 0, reserved: 0, blockedUntil: null, blockReason: null };
      this.months.set(key, row);
    }
    return row;
  }

  save(run: AiRun): Promise<void> {
    this.runs.set(run.id, run);
    return Promise.resolve();
  }

  findSucceededByCacheKey(cacheKey: string): Promise<AiRun | null> {
    const found = [...this.runs.values()].find(
      (run) => run.props.cacheKey === cacheKey && run.status === 'SUCCEEDED',
    );
    return Promise.resolve(found ?? null);
  }

  purgeOutputs(cutoff: Date, apply: boolean): Promise<number> {
    let count = 0;
    for (const run of [...this.runs.values()]) {
      if (run.props.createdAt < cutoff && run.props.output !== null) {
        count += 1;
        if (apply) this.runs.set(run.id, AiRun.restore({ ...run.props, output: null }));
      }
    }
    return Promise.resolve(count);
  }

  findById(id: string): Promise<AiRun | null> {
    return Promise.resolve(this.runs.get(id) ?? null);
  }

  listRecent(limit: number): Promise<AiRun[]> {
    return Promise.resolve(
      [...this.runs.values()]
        .sort((a, b) => b.props.createdAt.getTime() - a.props.createdAt.getTime())
        .slice(0, limit),
    );
  }

  reserve(request: ReserveRequest): Promise<ReserveOutcome> {
    const row = this.month(request.month);
    if (row.blockedUntil !== null && row.blockedUntil > request.now) {
      return Promise.resolve({ kind: 'providerBlocked', until: row.blockedUntil });
    }
    if (row.spent + row.reserved + request.run.props.reservedMicroUsd > request.capMicroUsd) {
      return Promise.resolve({ kind: 'exhausted' });
    }
    row.reserved += request.run.props.reservedMicroUsd;
    this.runs.set(request.run.id, request.run);
    return Promise.resolve({ kind: 'granted' });
  }

  settle(request: SettleRequest): Promise<boolean> {
    const current = this.runs.get(request.run.id);
    if (!current || current.status !== 'RESERVED') return Promise.resolve(false);
    const row = this.month(request.month);
    row.reserved -= request.releasedMicroUsd;
    row.spent += request.chargedMicroUsd;
    this.runs.set(request.run.id, request.run);
    return Promise.resolve(true);
  }

  abandonExpired(now: Date): Promise<number> {
    let count = 0;
    for (const run of [...this.runs.values()]) {
      const expires = run.props.reservationExpiresAt;
      if (run.status === 'RESERVED' && expires !== null && expires <= now) {
        const closed = run.finish({
          status: 'ABANDONED',
          costMicroUsd: run.props.reservedMicroUsd,
          failureKind: 'Abandoned',
          failureMessage: 'la reserva venció sin conciliar',
          durationMs: 0,
          finishedAt: now,
        });
        if (!closed.ok) continue;
        const row = this.month(run.props.budgetMonth);
        row.reserved -= run.props.reservedMicroUsd;
        row.spent += run.props.reservedMicroUsd;
        this.runs.set(run.id, closed.value);
        count += 1;
      }
    }
    return Promise.resolve(count);
  }

  blockProvider(month: string, until: Date, reason: string): Promise<void> {
    const row = this.month(month);
    row.blockedUntil = until;
    row.blockReason = reason;
    return Promise.resolve();
  }

  getMonth(month: string): Promise<BudgetMonthSnapshot | null> {
    const row = this.months.get(month);
    if (!row) return Promise.resolve(null);
    return Promise.resolve({
      month,
      spentMicroUsd: row.spent,
      reservedMicroUsd: row.reserved,
      providerBlockedUntil: row.blockedUntil,
      providerBlockReason: row.blockReason,
    });
  }

  /** Estado del mes para los asserts. */
  snapshot(month: string): { spent: number; reserved: number } {
    const row = this.month(month);
    return { spent: row.spent, reserved: row.reserved };
  }
}

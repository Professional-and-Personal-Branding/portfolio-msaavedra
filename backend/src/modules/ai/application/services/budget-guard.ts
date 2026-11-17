import { Clock } from '../../../../shared/domain/clock';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { AiRun, AiRunFinish, AiRunIdentity } from '../../domain/ai-run.entity';
import { AiBudgetExhaustedError } from '../../domain/errors/ai.errors';
import { AiBudgetRepository } from '../ports/ai-repositories';
import { AiGuardLogger, noopGuardLogger } from '../ports/ai-support.ports';

/** Margen que se suma al timeout para considerar huérfana una reserva (D8.4). */
export const ORPHAN_GRACE_MS = 60_000;
/** Un 400 de la Console no trae fecha de reinicio confiable: se vuelve a intentar a lo sumo cada hora. */
export const CONSOLE_BLOCK_MS = 60 * 60 * 1000;
/** Tope de un bloqueo con fecha: el reinicio del tier es el día 1 del mes siguiente. */
export const MAX_BLOCK_MS = 35 * 24 * 60 * 60 * 1000;

/** Mes calendario UTC `AAAA-MM`, igual que el reinicio del tope de Anthropic (D8.6). */
export function budgetMonthOf(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}`;
}

export interface BudgetGuardOptions {
  /** Tope mensual en micro-USD (`AI_MONTHLY_BUDGET_USD`). */
  readonly capMicroUsd: number;
  readonly requestTimeoutMs: number;
}

/**
 * Reservar, conciliar y no pasarse (D8). La atomicidad vive en el repositorio (un `UPDATE`
 * condicional por mes); acá se decide qué mes, cuándo vence una reserva y qué hacer con el
 * bloqueo del proveedor.
 */
export class BudgetGuard {
  constructor(
    private readonly repository: AiBudgetRepository,
    private readonly options: BudgetGuardOptions,
    private readonly clock: Clock,
    private readonly logger: AiGuardLogger = noopGuardLogger,
  ) {}

  get capMicroUsd(): number {
    return this.options.capMicroUsd;
  }

  /**
   * Barre las reservas huérfanas del mes y reserva el peor caso. Si no entra (o el proveedor
   * bloqueó el mes), devuelve el error y NO deja nada reservado.
   */
  async reserve(
    identity: AiRunIdentity,
    amountMicroUsd: number,
  ): Promise<Result<AiRun, AiBudgetExhaustedError>> {
    const now = identity.now;
    await this.repository.abandonExpired(now);
    const expiresAt = new Date(now.getTime() + this.options.requestTimeoutMs + ORPHAN_GRACE_MS);
    const run = AiRun.reserved(identity, amountMicroUsd, expiresAt);
    const outcome = await this.repository.reserve({
      run,
      month: identity.budgetMonth,
      capMicroUsd: this.options.capMicroUsd,
      now,
    });
    switch (outcome.kind) {
      case 'granted':
        return ok(run);
      case 'providerBlocked':
        return fail(AiBudgetExhaustedError.provider(outcome.until));
      case 'exhausted':
        return fail(AiBudgetExhaustedError.cap());
    }
  }

  /**
   * Cierra la corrida y concilia: libera la reserva y suma `finish.costMicroUsd` al gastado
   * (el costo real, 0, o la reserva entera si no se sabe si se facturó). Devuelve la corrida final.
   */
  async settle(run: AiRun, finish: AiRunFinish): Promise<AiRun> {
    const closed = run.finish(finish);
    if (!closed.ok) throw closed.error;
    const reserved = run.props.reservedMicroUsd;
    if (finish.costMicroUsd > reserved) {
      // El conteo subestimó la entrada más allá del margen: el exceso se imputa igual (D7), pero se avisa (B3).
      this.logger.warn('El costo liquidado de una corrida de IA superó lo reservado', {
        aiRunId: run.id,
        task: run.props.task,
        reservedMicroUsd: reserved,
        costMicroUsd: finish.costMicroUsd,
      });
    }
    const applied = await this.repository.settle({
      run: closed.value,
      month: run.props.budgetMonth,
      releasedMicroUsd: reserved,
      chargedMicroUsd: finish.costMicroUsd,
    });
    if (applied) return closed.value;
    // El barrido ya la había pasado a ABANDONED e imputado su reserva entera: no se concilia dos veces
    // y la corrida no puede quedar SUCCEEDED en silencio (B4).
    this.logger.warn('Se concilió una corrida de IA cuya reserva ya estaba abandonada', {
      aiRunId: run.id,
      task: run.props.task,
      reservedMicroUsd: reserved,
    });
    return AiRun.restore({
      ...run.props,
      status: 'ABANDONED',
      costMicroUsd: reserved,
      usage: finish.usage ?? run.props.usage,
      failureKind: 'Abandoned',
      failureMessage: 'la reserva venció antes de conciliar',
      durationMs: finish.durationMs,
      finishedAt: finish.finishedAt,
    });
  }

  /**
   * Un `BudgetExhausted` del proveedor bloquea el mes: hasta su fecha de reinicio si la trae
   * (acotada) o durante una hora si no.
   */
  async blockProvider(month: string, resetAt: Date | undefined, reason: string): Promise<Date> {
    const now = this.clock.now();
    const valid =
      resetAt !== undefined &&
      Number.isFinite(resetAt.getTime()) &&
      resetAt.getTime() > now.getTime();
    const until = valid
      ? new Date(Math.min(resetAt.getTime(), now.getTime() + MAX_BLOCK_MS))
      : new Date(now.getTime() + CONSOLE_BLOCK_MS);
    await this.repository.blockProvider(month, until, reason);
    return until;
  }
}

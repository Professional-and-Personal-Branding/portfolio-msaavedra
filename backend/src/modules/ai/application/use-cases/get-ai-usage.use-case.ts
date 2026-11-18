import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, Clock } from '../../../../shared/domain/clock';
import { computeAiUsageState, AiUsageState } from '../../domain/ai-usage-state';
import { microToUsd, usdToMicro } from '../../domain/estimate-cost';
import { PRICING_VERIFIED_AT } from '../../domain/model-pricing';
import { AiRunView, toAiRunView } from '../dto/ai-run.view';
import {
  AI_BUDGET_REPOSITORY,
  AI_RUN_REPOSITORY,
  AiBudgetRepository,
  AiRunRepository,
} from '../ports/ai-repositories';
import { AI_SETTINGS, AiSettings } from '../ports/ai-support.ports';
import { budgetMonthOf } from '../services/budget-guard';

export const RECENT_RUNS_LIMIT = 20;

export interface AiUsageOutput {
  readonly enabled: boolean;
  readonly provider: 'anthropic' | 'fake';
  readonly month: string;
  readonly budgetUsd: number;
  readonly spentUsd: number;
  readonly reservedUsd: number;
  readonly remainingUsd: number;
  /** Gastado sobre el tope, redondeado a entero (0 con tope 0). */
  readonly percentUsed: number;
  readonly state: AiUsageState;
  readonly providerBlockedUntil: string | null;
  readonly providerBlockReason: string | null;
  readonly pricingVerifiedAt: string;
  readonly recentRuns: AiRunView[];
}

/** Estado del gasto de IA del mes (D18). Responde también con la IA apagada: solo lee la base. */
@Injectable()
export class GetAiUsageUseCase {
  constructor(
    @Inject(AI_BUDGET_REPOSITORY) private readonly budget: AiBudgetRepository,
    @Inject(AI_RUN_REPOSITORY) private readonly runs: AiRunRepository,
    @Inject(AI_SETTINGS) private readonly settings: AiSettings,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(): Promise<AiUsageOutput> {
    const now = this.clock.now();
    const month = budgetMonthOf(now);
    const [snapshot, recent] = await Promise.all([
      this.budget.getMonth(month),
      this.runs.listRecent(RECENT_RUNS_LIMIT),
    ]);
    const cap = usdToMicro(this.settings.monthlyBudgetUsd);
    const spent = snapshot?.spentMicroUsd ?? 0;
    const reserved = snapshot?.reservedMicroUsd ?? 0;
    const blockedUntil = snapshot?.providerBlockedUntil ?? null;
    const active = blockedUntil !== null && blockedUntil > now;
    const state = computeAiUsageState({
      enabled: this.settings.enabled,
      capMicroUsd: cap,
      spentMicroUsd: spent,
      reservedMicroUsd: reserved,
      providerBlockedUntil: blockedUntil,
      now,
    });
    return {
      enabled: this.settings.enabled,
      provider: this.settings.provider,
      month,
      budgetUsd: microToUsd(cap),
      spentUsd: microToUsd(spent),
      reservedUsd: microToUsd(reserved),
      remainingUsd: microToUsd(Math.max(0, cap - spent - reserved)),
      percentUsed: cap > 0 ? Math.round((spent / cap) * 100) : 0,
      state,
      providerBlockedUntil: active ? blockedUntil.toISOString() : null,
      providerBlockReason: active ? (snapshot?.providerBlockReason ?? null) : null,
      pricingVerifiedAt: PRICING_VERIFIED_AT,
      recentRuns: recent.map(toAiRunView),
    };
  }
}

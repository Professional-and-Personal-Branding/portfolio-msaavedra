import type { AiRun, AiUsage } from '@/features/backoffice/shared/admin-types';

/** IA apagada: lo que devuelve la API sin `AI_ENABLED` (el default). */
export const AI_DISABLED_USAGE: AiUsage = {
  enabled: false,
  provider: 'anthropic',
  month: '2026-11',
  budgetUsd: 10,
  spentUsd: 0,
  reservedUsd: 0,
  remainingUsd: 10,
  percentUsed: 0,
  state: 'DISABLED',
  providerBlockedUntil: null,
  providerBlockReason: null,
  pricingVerifiedAt: '2026-11-17',
  recentRuns: [],
};

export function makeAiRun(overrides: Partial<AiRun> = {}): AiRun {
  return {
    id: 'run-1',
    task: 'ai.smoke',
    promptVersion: 1,
    model: 'claude-haiku-5-5',
    status: 'SUCCEEDED',
    inputTokens: 200,
    outputTokens: 50,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reservedMicroUsd: 290,
    costMicroUsd: 45,
    durationMs: 820,
    failureKind: null,
    failureMessage: null,
    stopReason: 'end_turn',
    fromCache: false,
    createdAt: '2026-11-17T12:00:00.000Z',
    finishedAt: '2026-11-17T12:00:01.000Z',
    ...overrides,
  };
}

export function makeAiUsage(overrides: Partial<AiUsage> = {}): AiUsage {
  return {
    ...AI_DISABLED_USAGE,
    enabled: true,
    provider: 'fake',
    state: 'OK',
    ...overrides,
  };
}

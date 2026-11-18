import { AiRun } from '../../domain/ai-run.entity';

/** Corrida de IA para el panel: sin entrada ni salida (D18). */
export interface AiRunView {
  readonly id: string;
  readonly task: string;
  readonly promptVersion: number;
  readonly model: string;
  readonly status: string;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheReadTokens: number | null;
  readonly cacheWriteTokens: number | null;
  readonly reservedMicroUsd: number;
  readonly costMicroUsd: number | null;
  readonly durationMs: number | null;
  readonly failureKind: string | null;
  readonly failureMessage: string | null;
  readonly stopReason: string | null;
  readonly fromCache: boolean;
  readonly createdAt: string;
  readonly finishedAt: string | null;
}

export function toAiRunView(run: AiRun): AiRunView {
  const p = run.props;
  return {
    id: p.id,
    task: p.task,
    promptVersion: p.promptVersion,
    model: p.model,
    status: p.status,
    inputTokens: p.usage?.inputTokens ?? null,
    outputTokens: p.usage?.outputTokens ?? null,
    cacheReadTokens: p.usage?.cacheReadTokens ?? null,
    cacheWriteTokens: p.usage?.cacheWriteTokens ?? null,
    reservedMicroUsd: p.reservedMicroUsd,
    costMicroUsd: p.costMicroUsd,
    durationMs: p.durationMs,
    failureKind: p.failureKind,
    failureMessage: p.failureMessage,
    stopReason: p.stopReason,
    fromCache: p.status === 'CACHED',
    createdAt: p.createdAt.toISOString(),
    finishedAt: p.finishedAt?.toISOString() ?? null,
  };
}

import { AiRun as AiRunRow, Prisma } from '@prisma/client';
import { AiRun } from '../../domain/ai-run.entity';

/** Fila de Prisma → entidad de dominio. */
export function toDomain(row: AiRunRow): AiRun {
  const hasUsage =
    row.inputTokens !== null ||
    row.outputTokens !== null ||
    row.cacheReadTokens !== null ||
    row.cacheWriteTokens !== null;
  return AiRun.restore({
    id: row.id,
    task: row.task,
    promptVersion: row.promptVersion,
    model: row.model,
    inputHash: row.inputHash,
    cacheKey: row.cacheKey,
    status: row.status,
    reservedMicroUsd: row.reservedMicroUsd,
    costMicroUsd: row.costMicroUsd,
    usage: hasUsage
      ? {
          inputTokens: row.inputTokens ?? 0,
          outputTokens: row.outputTokens ?? 0,
          cacheReadTokens: row.cacheReadTokens ?? 0,
          cacheWriteTokens: row.cacheWriteTokens ?? 0,
        }
      : null,
    stopReason: row.stopReason,
    failureKind: row.failureKind,
    failureMessage: row.failureMessage,
    output: row.output,
    requestId: row.requestId,
    durationMs: row.durationMs,
    budgetMonth: row.budgetMonth,
    reservationExpiresAt: row.reservationExpiresAt,
    createdAt: row.createdAt,
    finishedAt: row.finishedAt,
  });
}

/** Columnas que cambian al cerrar una corrida (todas menos la identidad). */
type FinalColumns = Pick<
  Prisma.AiRunUncheckedCreateInput,
  | 'status'
  | 'costMicroUsd'
  | 'inputTokens'
  | 'outputTokens'
  | 'cacheReadTokens'
  | 'cacheWriteTokens'
  | 'stopReason'
  | 'failureKind'
  | 'failureMessage'
  | 'output'
  | 'requestId'
  | 'durationMs'
  | 'finishedAt'
>;

export function toFinalData(run: AiRun): FinalColumns {
  const p = run.props;
  return {
    status: p.status,
    costMicroUsd: p.costMicroUsd,
    inputTokens: p.usage?.inputTokens ?? null,
    outputTokens: p.usage?.outputTokens ?? null,
    cacheReadTokens: p.usage?.cacheReadTokens ?? null,
    cacheWriteTokens: p.usage?.cacheWriteTokens ?? null,
    stopReason: p.stopReason,
    failureKind: p.failureKind,
    failureMessage: p.failureMessage,
    output: jsonOrNull(p.output),
    requestId: p.requestId,
    durationMs: p.durationMs,
    finishedAt: p.finishedAt,
  };
}

export function toCreateData(run: AiRun): Prisma.AiRunUncheckedCreateInput {
  const p = run.props;
  return {
    id: p.id,
    task: p.task,
    promptVersion: p.promptVersion,
    model: p.model,
    inputHash: p.inputHash,
    cacheKey: p.cacheKey,
    reservedMicroUsd: p.reservedMicroUsd,
    budgetMonth: p.budgetMonth,
    reservationExpiresAt: p.reservationExpiresAt,
    createdAt: p.createdAt,
    ...toFinalData(run),
  };
}

function jsonOrNull(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === null || value === undefined ? Prisma.DbNull : value;
}

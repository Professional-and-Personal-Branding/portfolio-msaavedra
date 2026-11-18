import { ApiProperty } from '@nestjs/swagger';
import { AiRunView } from '../../../application/dto/ai-run.view';
import { AiUsageOutput } from '../../../application/use-cases/get-ai-usage.use-case';

const RUN_STATUSES = [
  'RESERVED',
  'SUCCEEDED',
  'CACHED',
  'REFUSED',
  'FAILED',
  'ABANDONED',
  'BLOCKED',
];
const USAGE_STATES = ['DISABLED', 'OK', 'NEAR_LIMIT', 'EXHAUSTED', 'PROVIDER_BLOCKED'];

export class AiRunResponse implements AiRunView {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'ai.smoke' }) task!: string;
  @ApiProperty() promptVersion!: number;
  @ApiProperty({ example: 'claude-haiku-5-5' }) model!: string;
  @ApiProperty({ enum: RUN_STATUSES, enumName: 'AiRunStatus' }) status!: string;
  @ApiProperty({ nullable: true, type: Number }) inputTokens!: number | null;
  @ApiProperty({ nullable: true, type: Number }) outputTokens!: number | null;
  @ApiProperty({ nullable: true, type: Number }) cacheReadTokens!: number | null;
  @ApiProperty({ nullable: true, type: Number }) cacheWriteTokens!: number | null;
  @ApiProperty({ description: 'Reserva previa, en micro-USD (1 USD = 1 000 000)' })
  reservedMicroUsd!: number;
  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Costo real imputado, en micro-USD; `null` mientras la corrida sigue reservada',
  })
  costMicroUsd!: number | null;
  @ApiProperty({ nullable: true, type: Number }) durationMs!: number | null;
  @ApiProperty({ nullable: true, type: String, example: 'Transient' }) failureKind!: string | null;
  @ApiProperty({ nullable: true, type: String, description: 'Redactado y de hasta 500 caracteres' })
  failureMessage!: string | null;
  @ApiProperty({ nullable: true, type: String }) stopReason!: string | null;
  @ApiProperty({ description: '`true` si se sirvió desde la caché (sin llamada y sin costo)' })
  fromCache!: boolean;
  @ApiProperty({ description: 'ISO 8601' }) createdAt!: string;
  @ApiProperty({ nullable: true, type: String, description: 'ISO 8601' }) finishedAt!:
    string | null;
}

export class AiUsageResponse implements AiUsageOutput {
  @ApiProperty({ description: '`false` = `AI_ENABLED` apagado en este servidor' })
  enabled!: boolean;
  @ApiProperty({ enum: ['anthropic', 'fake'], enumName: 'AiProvider' })
  provider!: 'anthropic' | 'fake';
  @ApiProperty({ example: '2026-11', description: 'Mes calendario UTC' }) month!: string;
  @ApiProperty({ description: 'Tope mensual en USD (`AI_MONTHLY_BUDGET_USD`)' }) budgetUsd!: number;
  @ApiProperty() spentUsd!: number;
  @ApiProperty() reservedUsd!: number;
  @ApiProperty() remainingUsd!: number;
  @ApiProperty({ description: 'Gastado sobre el tope, redondeado a entero' }) percentUsed!: number;
  @ApiProperty({ enum: USAGE_STATES, enumName: 'AiUsageState' })
  state!: AiUsageOutput['state'];
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'ISO 8601; solo si el corte sigue vigente',
  })
  providerBlockedUntil!: string | null;
  @ApiProperty({ nullable: true, type: String }) providerBlockReason!: string | null;
  @ApiProperty({ example: '2026-11-17', description: 'Cuándo se verificó la tabla de precios' })
  pricingVerifiedAt!: string;
  @ApiProperty({
    type: () => [AiRunResponse],
    description: 'Las 20 más recientes, sin entradas ni salidas',
  })
  recentRuns!: AiRunResponse[];
}

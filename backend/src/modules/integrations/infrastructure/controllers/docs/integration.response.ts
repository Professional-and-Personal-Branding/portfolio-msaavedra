import { ApiProperty } from '@nestjs/swagger';
import {
  CredentialStatusOutput,
  EnqueueSyncOutput,
  IntegrationsOverviewOutput,
  IntegrationStatusOutput,
  JobCountsOutput,
  LastRunOutput,
} from '../../../application/dto/integration-status.output';

const JOB_STATUSES = ['PENDING', 'RUNNING', 'DONE', 'FAILED', 'DEAD'];
const SYNC_RUN_OUTCOMES = ['SUCCESS', 'FAILED', 'DEAD', 'INTERRUPTED', 'TIMEOUT'];

export class LastRunResponse implements LastRunOutput {
  @ApiProperty({
    enum: SYNC_RUN_OUTCOMES,
    enumName: 'SyncRunOutcome',
    nullable: true,
    description: '`null` mientras el intento sigue en curso',
  })
  outcome!: string | null;
  @ApiProperty({ description: 'ISO 8601' }) startedAt!: string;
  @ApiProperty({ nullable: true, type: String, description: 'ISO 8601' }) finishedAt!:
    string | null;
  @ApiProperty({ nullable: true, type: String, example: 'Transient' }) errorClass!: string | null;
  @ApiProperty({ nullable: true, type: String, description: 'Redactado y de hasta 500 caracteres' })
  errorMessage!: string | null;
}

export class JobCountsResponse implements JobCountsOutput {
  @ApiProperty() pending!: number;
  @ApiProperty() running!: number;
  @ApiProperty() failed!: number;
  @ApiProperty() dead!: number;
}

export class CredentialStatusResponse implements CredentialStatusOutput {
  @ApiProperty({
    enum: ['env', 'db'],
    nullable: true,
    description: 'De dónde sale el secreto: variable de entorno, base cifrada o ninguna',
  })
  source!: 'env' | 'db' | null;
  @ApiProperty({ nullable: true, type: String, description: 'Clave del keyring que la cifró' })
  keyId!: string | null;
  @ApiProperty({ nullable: true, type: String, description: 'ISO 8601' }) updatedAt!: string | null;
}

export class IntegrationStatusResponse implements IntegrationStatusOutput {
  @ApiProperty({ example: 'fake' }) provider!: string;
  @ApiProperty({ description: '`false` = pausado a mano' }) enabled!: boolean;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'ISO 8601; solo si la pausa sigue vigente',
  })
  pausedUntil!: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    example: 'RetryAfter',
    description: '`RetryAfter`, `ResetAt`, `BudgetExhausted` o `CircuitOpen`',
  })
  pauseReason!: string | null;
  @ApiProperty({ description: 'Más de 48 h sin una corrida exitosa' }) stale!: boolean;
  @ApiProperty({ nullable: true, type: String, description: 'ISO 8601' }) lastSuccessAt!:
    string | null;
  @ApiProperty({ nullable: true, type: () => LastRunResponse }) lastRun!: LastRunResponse | null;
  @ApiProperty({ type: () => JobCountsResponse }) jobs!: JobCountsResponse;
  @ApiProperty({ nullable: true, type: String, description: 'Último error de un trabajo `DEAD`' })
  lastDeadError!: string | null;
  @ApiProperty({ type: () => CredentialStatusResponse }) credential!: CredentialStatusResponse;
}

export class IntegrationsOverviewResponse implements IntegrationsOverviewOutput {
  @ApiProperty({ description: '`false` = este proceso no tiene timers: lo encolado espera' })
  schedulerEnabled!: boolean;
  @ApiProperty({ type: () => [IntegrationStatusResponse] }) providers!: IntegrationStatusResponse[];
}

export class EnqueueSyncResponse implements EnqueueSyncOutput {
  @ApiProperty() jobId!: string;
  @ApiProperty({ enum: JOB_STATUSES, enumName: 'IntegrationJobStatus' }) status!: string;
  @ApiProperty({ description: 'ISO 8601: cuándo puede reclamarse' }) runAt!: string;
  @ApiProperty({ description: '`true` si ya había una sincronización en cola' })
  alreadyQueued!: boolean;
}

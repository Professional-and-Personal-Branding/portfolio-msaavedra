import { Inject, Injectable } from '@nestjs/common';
import { AI_RUN_REPOSITORY, AiRunRepository } from '../ports/ai-repositories';

/** Días que se conserva la salida validada de una corrida (P4 de `add-ai-foundation`). */
export const AI_OUTPUT_RETENTION_DAYS = 180;

export interface PurgeAiRunOutputsResult {
  readonly cutoff: Date;
  readonly affected: number;
  readonly applied: boolean;
}

/**
 * Deja en nulo el `output` de las corridas de IA de más de 180 días (retención de la salida
 * derivada de una vacante). Conserva tarea, versión, modelo, hash de la entrada, tokens, costo y
 * estado: las métricas y el gasto no se tocan. Sin `apply` solo cuenta (simulación).
 */
@Injectable()
export class PurgeAiRunOutputsUseCase {
  constructor(@Inject(AI_RUN_REPOSITORY) private readonly runs: AiRunRepository) {}

  async execute(input: { now: Date; apply: boolean }): Promise<PurgeAiRunOutputsResult> {
    const cutoff = new Date(input.now.getTime() - AI_OUTPUT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const affected = await this.runs.purgeOutputs(cutoff, input.apply);
    return { cutoff, affected, applied: input.apply };
  }
}

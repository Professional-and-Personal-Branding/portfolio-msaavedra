import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/domain/errors';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { AiRunFailedError } from '../../domain/errors/ai-run-failed.error';
import { AiRunView, toAiRunView } from '../dto/ai-run.view';
import { AI_RUN_REPOSITORY, AiRunRepository } from '../ports/ai-repositories';
import { AiTaskRunner } from '../services/ai-task-runner';
import { aiSmokeTask } from '../tasks/ai-smoke.task';

/**
 * «Probar conexión» (D18): corre la tarea de humo siempre con `bypassCache`, porque si no la
 * segunda prueba no probaría la conexión. Una corrida que llegó a llamar y falló (transitorio,
 * spend limit, rechazo) se devuelve como la corrida `FAILED`/`REFUSED`; los cortes previos
 * (IA apagada, tope, ocupado) salen como error.
 */
@Injectable()
export class RunAiSmokeTestUseCase {
  constructor(
    private readonly runner: AiTaskRunner,
    @Inject(AI_RUN_REPOSITORY) private readonly runs: AiRunRepository,
  ) {}

  async execute(input: { signal?: AbortSignal } = {}): Promise<Result<AiRunView, DomainError>> {
    const result = await this.runner.run(aiSmokeTask, undefined, {
      bypassCache: true,
      ...(input.signal ? { signal: input.signal } : {}),
    });
    if (result.ok) return ok(toAiRunView(result.value.run));
    if (result.error instanceof AiRunFailedError) {
      const run = await this.runs.findById(result.error.runId);
      if (run) return ok(toAiRunView(run));
    }
    return fail(result.error);
  }
}

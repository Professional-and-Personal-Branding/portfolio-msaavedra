import { AiRun } from '../../domain/ai-run.entity';
import { InMemoryAiStore } from '../../infrastructure/memory/in-memory-ai-store';
import {
  AI_OUTPUT_RETENTION_DAYS,
  PurgeAiRunOutputsUseCase,
} from './purge-ai-run-outputs.use-case';

const NOW = new Date('2026-11-17T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function runAt(id: string, daysAgo: number, output: unknown): AiRun {
  const createdAt = new Date(NOW.getTime() - daysAgo * DAY);
  return AiRun.cached(
    {
      id,
      task: 'ai.smoke',
      promptVersion: 1,
      model: 'claude-haiku-5-5',
      inputHash: 'h',
      cacheKey: `k-${id}`,
      budgetMonth: '2026-11',
      now: createdAt,
    },
    output,
  );
}

describe('PurgeAiRunOutputsUseCase', () => {
  async function setup() {
    const store = new InMemoryAiStore();
    await store.save(runAt('vieja', AI_OUTPUT_RETENTION_DAYS + 1, { estado: 'ok' }));
    await store.save(runAt('justa', AI_OUTPUT_RETENTION_DAYS - 1, { estado: 'ok' }));
    await store.save(runAt('sin-salida', AI_OUTPUT_RETENTION_DAYS + 30, null));
    return { store, useCase: new PurgeAiRunOutputsUseCase(store) };
  }

  it('simulación: cuenta las corridas de más de 180 días con salida y no escribe', async () => {
    const { store, useCase } = await setup();
    const result = await useCase.execute({ now: NOW, apply: false });
    expect(result).toMatchObject({ affected: 1, applied: false });
    expect(store.runs.get('vieja')?.props.output).toEqual({ estado: 'ok' });
  });

  it('apply: deja en nulo solo el output de la vieja y conserva el resto de la corrida', async () => {
    const { store, useCase } = await setup();
    const result = await useCase.execute({ now: NOW, apply: true });
    expect(result.affected).toBe(1);
    const vieja = store.runs.get('vieja')?.props;
    expect(vieja?.output).toBeNull();
    expect(vieja).toMatchObject({ task: 'ai.smoke', status: 'CACHED', costMicroUsd: 0 });
    expect(store.runs.get('justa')?.props.output).toEqual({ estado: 'ok' });
  });

  it('es idempotente', async () => {
    const { useCase } = await setup();
    await useCase.execute({ now: NOW, apply: true });
    expect((await useCase.execute({ now: NOW, apply: true })).affected).toBe(0);
  });

  it('el corte es a los 180 días exactos', async () => {
    const { useCase } = await setup();
    const result = await useCase.execute({ now: NOW, apply: false });
    expect(result.cutoff.getTime()).toBe(NOW.getTime() - 180 * DAY);
  });
});

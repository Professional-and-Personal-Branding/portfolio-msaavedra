import { Injectable } from '@nestjs/common';
import { fail, ok, Result } from '../../../../../shared/domain/result';
import { ConnectorPort, SyncContext, SyncOutcome } from '../../../application/ports/connector.port';
import {
  budgetExhausted,
  permanent,
  ProviderFailure,
  resetAt,
  retryAfter,
  transient,
} from '../../../domain/provider-failure';

export const FAKE_SCENARIOS = [
  'ok',
  'not-modified',
  'slow',
  'transient',
  'permanent',
  'retry-after',
  'reset-at',
  'budget',
  'throw',
  'leak-secret',
  'ignore-abort',
] as const;
export type FakeScenario = (typeof FAKE_SCENARIOS)[number];

const RESOURCE_KEY = 'fake:items';

function numberFrom(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** Trabajo sincrónico de unos milisegundos: simula parsear una página de respuesta (D22). */
function burnCpu(ms: number): void {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    // espera activa a propósito
  }
}

/**
 * Proveedor de pruebas (D24): el escenario sale de `payload.scenario`. Existe para los e2e, el
 * manual y el TC-49; el arranque lo prohíbe con `NODE_ENV=production` (D11).
 */
@Injectable()
export class FakeConnector implements ConnectorPort {
  readonly id = 'fake';
  readonly requiredEnv: readonly string[] = ['FAKE_PROVIDER_TOKEN'];
  private readonly calls = new Map<string, number>();

  /** Llamadas por escenario, solo para tests. */
  callsFor(scenario: string): number {
    return this.calls.get(scenario) ?? 0;
  }

  get totalCalls(): number {
    return [...this.calls.values()].reduce((sum, n) => sum + n, 0);
  }

  resetCalls(): void {
    this.calls.clear();
  }

  async sync(ctx: SyncContext, signal: AbortSignal): Promise<Result<SyncOutcome, ProviderFailure>> {
    const requested = ctx.payload.scenario;
    const scenario: FakeScenario = FAKE_SCENARIOS.includes(requested as FakeScenario)
      ? (requested as FakeScenario)
      : 'ok';
    this.calls.set(scenario, this.callsFor(scenario) + 1);

    switch (scenario) {
      case 'ok': {
        const body = { items: ctx.payload.items ?? [1, 2, 3] };
        const recorded = await ctx.snapshots.record(this.id, RESOURCE_KEY, { body });
        if (!recorded.ok) return fail(recorded.error);
        return ok({ itemsChanged: recorded.value.changed ? 1 : 0 });
      }
      case 'not-modified':
        await ctx.snapshots.recordNotModified(this.id, RESOURCE_KEY, new Date());
        return ok({ itemsChanged: 0 });
      case 'slow':
        return this.slow(ctx, signal);
      case 'transient':
        return fail(transient('fake: error transitorio'));
      case 'permanent':
        return fail(permanent('fake: error permanente'));
      case 'retry-after':
        return fail(retryAfter(numberFrom(ctx.payload.seconds, 120), 'fake: esperá un rato'));
      case 'reset-at':
        return fail(
          resetAt(
            new Date(Date.now() + numberFrom(ctx.payload.afterMs, 3_600_000)),
            'fake: límite agotado',
          ),
        );
      case 'budget':
        return fail(budgetExhausted('fake: presupuesto agotado'));
      case 'throw':
        throw new Error('fake: explotó el conector');
      case 'leak-secret':
        return fail(transient(`fake: falló con el token ${ctx.secret} en la cabecera`));
      case 'ignore-abort':
        // No escucha la señal: el ejecutor no tiene que colgarse esperándolo.
        await new Promise<void>((resolve) => {
          setTimeout(resolve, numberFrom(ctx.payload.ms, 10_000)).unref();
        });
        return ok({ itemsChanged: 0 });
    }
  }

  /** `steps` pasos de `stepMs` con `workMs` de CPU cada uno; respeta la señal de aborto. */
  private async slow(
    ctx: SyncContext,
    signal: AbortSignal,
  ): Promise<Result<SyncOutcome, ProviderFailure>> {
    const steps = numberFrom(ctx.payload.steps, 30);
    const stepMs = numberFrom(ctx.payload.stepMs, 100);
    const workMs = numberFrom(ctx.payload.workMs, 5);
    for (let i = 0; i < steps; i++) {
      if (signal.aborted) return fail(transient('fake: abortado'));
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, stepMs);
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
      });
      if (signal.aborted) return fail(transient('fake: abortado'));
      burnCpu(workMs);
    }
    return ok({ itemsChanged: 0 });
  }
}

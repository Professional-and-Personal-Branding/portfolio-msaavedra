import { IntegrationJob } from '../../../modules/integrations/domain/entities/integration-job.entity';
import { IntegrationSetting } from '../../../modules/integrations/domain/entities/integration-setting.entity';
import { classifyAnthropicError } from './classify-anthropic-error';
import { classifyHttpFailure } from '../../../modules/integrations/domain/services/classify-http-failure';
import { MAX_RESET_HORIZON_MS, MAX_RETRY_AFTER_SECONDS, sanitizeFailure } from './sanitize-failure';

const NOW = new Date('2026-11-12T12:00:00.000Z');
const DAY = 86_400_000;

describe('sanitizeFailure (M2)', () => {
  it('RetryAfter: no finito → Transient; negativo o cero → 1 s; enorme → 24 h', () => {
    for (const seconds of [Number.NaN, Infinity, -Infinity]) {
      expect(sanitizeFailure({ kind: 'RetryAfter', seconds, message: 'm' }, NOW).kind).toBe(
        'Transient',
      );
    }
    expect(sanitizeFailure({ kind: 'RetryAfter', seconds: -5, message: 'm' }, NOW)).toMatchObject({
      seconds: 1,
    });
    expect(sanitizeFailure({ kind: 'RetryAfter', seconds: 1e20, message: 'm' }, NOW)).toMatchObject(
      {
        seconds: MAX_RETRY_AFTER_SECONDS,
      },
    );
  });

  it('ResetAt: fecha inválida → Transient; pasada → ahora; a 30 años → 7 días', () => {
    expect(
      sanitizeFailure({ kind: 'ResetAt', at: new Date(Number.NaN), message: 'm' }, NOW).kind,
    ).toBe('Transient');
    const past = sanitizeFailure(
      { kind: 'ResetAt', at: new Date(NOW.getTime() - DAY), message: 'm' },
      NOW,
    );
    expect(past.kind === 'ResetAt' && past.at).toEqual(NOW);
    const far = sanitizeFailure(
      { kind: 'ResetAt', at: new Date(NOW.getTime() + 30 * 365 * DAY), message: 'm' },
      NOW,
    );
    expect(far.kind === 'ResetAt' && far.at).toEqual(
      new Date(NOW.getTime() + MAX_RESET_HORIZON_MS),
    );
  });

  it('BudgetExhausted: resetAt inválido se descarta y uno lejano se acota', () => {
    const bad = sanitizeFailure(
      { kind: 'BudgetExhausted', resetAt: new Date(Number.NaN), message: 'm' },
      NOW,
    );
    expect(bad).not.toHaveProperty('resetAt');
    const far = sanitizeFailure(
      { kind: 'BudgetExhausted', resetAt: new Date(NOW.getTime() + 999 * DAY), message: 'm' },
      NOW,
    );
    expect(far.kind === 'BudgetExhausted' && far.resetAt).toEqual(
      new Date(NOW.getTime() + MAX_RESET_HORIZON_MS),
    );
  });

  it('es idempotente', () => {
    const once = sanitizeFailure({ kind: 'RetryAfter', seconds: 1e20, message: 'm' }, NOW);
    expect(sanitizeFailure(once, NOW)).toEqual(once);
  });

  it('los clasificadores no producen NaN con valores enormes', () => {
    const huge = '9'.repeat(400);
    expect(classifyHttpFailure({ status: 429, headers: { 'retry-after': huge } }).kind).toBe(
      'Transient',
    );
    expect(
      classifyHttpFailure({ status: 429, headers: { 'retry-after': '99999999999999999999' } }),
    ).toMatchObject({ kind: 'RetryAfter' });
    expect(
      classifyHttpFailure({
        status: 429,
        headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1e300' },
      }).kind,
    ).not.toBe('ResetAt');
    expect(classifyAnthropicError({ status: 429, retryAfter: huge, body: {} }).kind).toBe(
      'Transient',
    );
  });

  it('un trabajo con Retry-After enorme queda FAILED con un runAt válido y una pausa de 24 h como máximo', () => {
    const job = new IntegrationJob({
      id: 'j',
      provider: 'fake',
      kind: 'sync',
      idempotencyKey: 'k',
      payload: {},
      status: 'RUNNING',
      attempts: 1,
      maxAttempts: 8,
      runAt: NOW,
      lockedBy: 'h',
      lockedUntil: NOW,
      lastErrorClass: null,
      lastError: null,
      createdAt: NOW,
      updatedAt: NOW,
      finishedAt: null,
    });
    const failure = { kind: 'RetryAfter', seconds: 1e20, message: 'm' } as const;
    const failed = job.fail(failure, NOW, () => 0);
    if (!failed.ok) throw failed.error;
    expect(Number.isFinite(failed.value.props.runAt.getTime())).toBe(true);
    expect(failed.value.props.runAt.getTime()).toBeLessThanOrEqual(
      NOW.getTime() + DAY * 1000 + 6000,
    );
    const setting = IntegrationSetting.initial('fake', NOW).recordFailure(failure, NOW);
    expect(setting.props.pausedUntil).toEqual(new Date(NOW.getTime() + DAY));
  });

  it('reanudar un proveedor ya habilitado limpia la pausa y el breaker', () => {
    const paused = IntegrationSetting.initial('fake', NOW).recordFailure(
      { kind: 'ResetAt', at: new Date(NOW.getTime() + 6 * DAY), message: 'm' },
      NOW,
    );
    expect(paused.isClaimable(NOW)).toBe(false);
    const resumed = paused.withEnabled(true, NOW);
    expect(resumed.props).toMatchObject({
      pausedUntil: null,
      pauseReason: null,
      consecutiveFailures: 0,
    });
    expect(resumed.isClaimable(NOW)).toBe(true);
  });
});

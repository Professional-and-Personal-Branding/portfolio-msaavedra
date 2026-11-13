import { classifyHttpFailure } from './classify-http-failure';

const NOW = new Date('2026-11-12T12:00:00.000Z');

describe('classifyHttpFailure', () => {
  it('red caída o timeout → Transient', () => {
    expect(classifyHttpFailure({ networkError: true }).kind).toBe('Transient');
    expect(classifyHttpFailure({}).kind).toBe('Transient');
  });

  it.each([408, 425, 500, 502, 503, 504])('%i → Transient', (status) => {
    expect(classifyHttpFailure({ status }).kind).toBe('Transient');
  });

  it('429 con Retry-After en segundos → RetryAfter', () => {
    expect(classifyHttpFailure({ status: 429, headers: { 'Retry-After': '120' } })).toMatchObject({
      kind: 'RetryAfter',
      seconds: 120,
    });
  });

  it('429 con Retry-After como fecha HTTP → RetryAfter con los segundos hasta esa fecha', () => {
    const failure = classifyHttpFailure({
      status: 429,
      headers: { 'retry-after': 'Thu, 12 Nov 2026 12:02:00 GMT' },
      now: NOW,
    });
    expect(failure).toMatchObject({ kind: 'RetryAfter', seconds: 120 });
  });

  it('429 con X-RateLimit-Remaining 0 y Reset (epoch) → ResetAt', () => {
    const reset = Math.floor(NOW.getTime() / 1000) + 600;
    const failure = classifyHttpFailure({
      status: 429,
      headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) },
    });
    expect(failure).toEqual(expect.objectContaining({ kind: 'ResetAt' }));
    if (failure.kind === 'ResetAt') expect(failure.at.getTime()).toBe(reset * 1000);
  });

  it('403 con X-RateLimit-Remaining 0 y Reset → ResetAt', () => {
    expect(
      classifyHttpFailure({
        status: 403,
        headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000000' },
      }).kind,
    ).toBe('ResetAt');
  });

  it('429 sin pistas → Transient', () => {
    expect(classifyHttpFailure({ status: 429 }).kind).toBe('Transient');
  });

  it.each([400, 401, 403, 404, 410, 422])('%i sin pistas → Permanent', (status) => {
    expect(classifyHttpFailure({ status }).kind).toBe('Permanent');
  });

  it('un campo backoff en el cuerpo → RetryAfter', () => {
    expect(classifyHttpFailure({ status: 400, body: { backoff: 30 } })).toMatchObject({
      kind: 'RetryAfter',
      seconds: 30,
    });
  });

  it('un cuerpo sin backoff no cambia la clasificación', () => {
    expect(classifyHttpFailure({ status: 404, body: { message: 'no' } }).kind).toBe('Permanent');
  });
});

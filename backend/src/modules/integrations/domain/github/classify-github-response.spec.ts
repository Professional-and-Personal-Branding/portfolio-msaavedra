import {
  classifyGithubResponse,
  GITHUB_RATE_RESERVE,
  GithubVerdict,
  quotaReserveFailure,
  TOKEN_REJECTED_MESSAGE,
} from './classify-github-response';

const NOW = new Date('2026-11-16T10:00:00Z');
const RESET_EPOCH = Math.floor(NOW.getTime() / 1000) + 1800;

function classify(
  status: number,
  headers: Record<string, string> = {},
  body?: unknown,
): GithubVerdict {
  return classifyGithubResponse({ status, headers, body }, NOW);
}

function failureOf(verdict: GithubVerdict) {
  if (verdict.kind !== 'job') throw new Error(`se esperaba un fallo del trabajo: ${verdict.kind}`);
  return verdict.failure;
}

describe('classifyGithubResponse (D6)', () => {
  it('200 → datos y 304 → sin cambios', () => {
    expect(classify(200)).toEqual({ kind: 'data' });
    expect(classify(304)).toEqual({ kind: 'notModified' });
  });

  it('401 → Permanent con el mensaje del token', () => {
    expect(failureOf(classify(401))).toEqual({
      kind: 'Permanent',
      message: TOKEN_REJECTED_MESSAGE,
    });
  });

  it.each([403, 429])('%i con retry-after en segundos → RetryAfter', (status) => {
    expect(failureOf(classify(status, { 'retry-after': '120' }))).toMatchObject({
      kind: 'RetryAfter',
      seconds: 120,
    });
  });

  it('403 con retry-after como fecha HTTP → RetryAfter de los segundos que faltan', () => {
    const date = new Date(NOW.getTime() + 90_000).toUTCString();
    expect(failureOf(classify(403, { 'retry-after': date }))).toMatchObject({
      kind: 'RetryAfter',
      seconds: 90,
    });
  });

  it.each([403, 429])('%i con x-ratelimit-remaining 0 y reset → ResetAt', (status) => {
    const failure = failureOf(
      classify(status, {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(RESET_EPOCH),
      }),
    );
    expect(failure).toMatchObject({ kind: 'ResetAt' });
    expect(failure.kind === 'ResetAt' && failure.at.getTime()).toBe(RESET_EPOCH * 1000);
  });

  it('retry-after gana sobre x-ratelimit-reset', () => {
    expect(
      failureOf(
        classify(403, {
          'retry-after': '30',
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(RESET_EPOCH),
        }),
      ),
    ).toMatchObject({ kind: 'RetryAfter', seconds: 30 });
  });

  it.each([403, 429])(
    '%i con un mensaje de «rate limit» y sin cabeceras → RetryAfter de 60 s',
    (s) => {
      expect(
        failureOf(classify(s, {}, { message: 'You have exceeded a secondary rate limit.' })),
      ).toMatchObject({ kind: 'RetryAfter', seconds: 60 });
    },
  );

  it('429 sin ninguna pista → RetryAfter de 60 s', () => {
    expect(failureOf(classify(429))).toMatchObject({ kind: 'RetryAfter', seconds: 60 });
  });

  it('403 con x-ratelimit-remaining distinto de 0 y sin mensaje de límite → repo INACCESSIBLE', () => {
    expect(classify(403, { 'x-ratelimit-remaining': '4000' })).toMatchObject({
      kind: 'repo',
      status: 'INACCESSIBLE',
    });
    expect(classify(403)).toMatchObject({ kind: 'repo', status: 'INACCESSIBLE' });
  });

  it.each([404, 410])('%i → repo NOT_FOUND', (status) => {
    expect(classify(status)).toMatchObject({ kind: 'repo', status: 'NOT_FOUND' });
  });

  it('451 → repo INACCESSIBLE', () => {
    expect(classify(451)).toMatchObject({ kind: 'repo', status: 'INACCESSIBLE' });
  });

  it.each([301, 302, 307, 308])('%i sin resolver → repo INACCESSIBLE', (status) => {
    expect(classify(status, { location: 'https://example.com/x' })).toMatchObject({
      kind: 'repo',
      status: 'INACCESSIBLE',
      reason: 'GitHub redirigió fuera de la API',
    });
  });

  it.each([408, 500, 502, 503, 504])('%i → Transient', (status) => {
    expect(failureOf(classify(status)).kind).toBe('Transient');
  });

  it.each([400, 422])('%i → Permanent con HTTP <status>', (status) => {
    expect(failureOf(classify(status))).toEqual({ kind: 'Permanent', message: `HTTP ${status}` });
  });

  it('el mensaje del fallo no incluye cabeceras ni el cuerpo', () => {
    const failure = failureOf(
      classify(
        403,
        { 'retry-after': '10', authorization: 'Bearer secreto' },
        { message: 'secondary rate limit con cuerpo secreto' },
      ),
    );
    expect(failure.message).not.toContain('secreto');
  });
});

describe('quotaReserveFailure (D7)', () => {
  const headers = (remaining: string, reset: string | null = String(RESET_EPOCH)) => ({
    'x-ratelimit-remaining': remaining,
    ...(reset === null ? {} : { 'x-ratelimit-reset': reset }),
  });

  it('la reserva es de 50', () => {
    expect(GITHUB_RATE_RESERVE).toBe(50);
  });

  it('con 40 restantes y reset → ResetAt en ese instante', () => {
    const failure = quotaReserveFailure(headers('40'));
    expect(failure).toMatchObject({ kind: 'ResetAt' });
    expect(failure?.kind === 'ResetAt' && failure.at.getTime()).toBe(RESET_EPOCH * 1000);
  });

  it('con exactamente 50 restantes también se detiene', () => {
    expect(quotaReserveFailure(headers('50'))?.kind).toBe('ResetAt');
  });

  it('con 51 restantes sigue', () => {
    expect(quotaReserveFailure(headers('51'))).toBeNull();
  });

  it('sin cabeceras o sin reset sigue', () => {
    expect(quotaReserveFailure({})).toBeNull();
    expect(quotaReserveFailure(headers('3', null))).toBeNull();
    expect(quotaReserveFailure(headers('x'))).toBeNull();
  });
});

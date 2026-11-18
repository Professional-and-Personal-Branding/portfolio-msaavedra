import * as fs from 'fs';
import * as path from 'path';
import { classifyAnthropicError } from './classify-anthropic-error';

function fixture(name: string): unknown {
  const file = path.resolve(__dirname, '../../../../test/fixtures/anthropic', name);
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

describe('classifyAnthropicError', () => {
  it('429 enforced_spend_limit_reached → BudgetExhausted con resetAt el 1 del mes siguiente', () => {
    const failure = classifyAnthropicError({
      status: 429,
      body: fixture('spend-limit-429.json'),
      now: new Date('2026-03-15T10:00:00Z'),
    });
    expect(failure.kind).toBe('BudgetExhausted');
    if (failure.kind === 'BudgetExhausted') {
      expect(failure.resetAt?.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    }
  });

  it('el 31 de diciembre el reinicio es el 1 de enero del año siguiente', () => {
    const failure = classifyAnthropicError({
      status: 429,
      body: fixture('spend-limit-429.json'),
      now: new Date('2026-12-31T23:59:00Z'),
    });
    if (failure.kind !== 'BudgetExhausted') throw new Error('se esperaba BudgetExhausted');
    expect(failure.resetAt?.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  // Forma heredada (heurística): se mantiene por si el texto de la Console cambia.
  it('400 invalid_request_error con texto de tope → BudgetExhausted sin resetAt', () => {
    const failure = classifyAnthropicError({ status: 400, body: fixture('spend-limit-400.json') });
    expect(failure.kind).toBe('BudgetExhausted');
    expect(failure).not.toHaveProperty('resetAt');
  });

  it.each(['spend-limit-400-console.json', 'spend-limit-400-workspace.json'])(
    '400 con el texto confirmado de la Console (%s) → BudgetExhausted sin resetAt',
    (name) => {
      const failure = classifyAnthropicError({ status: 400, body: fixture(name) });
      expect(failure.kind).toBe('BudgetExhausted');
      expect(failure).not.toHaveProperty('resetAt');
    },
  );

  it('429 ramp_limit_exceeded con retry-after → RetryAfter, nunca BudgetExhausted', () => {
    const failure = classifyAnthropicError({
      status: 429,
      body: fixture('ramp-limit-429.json'),
      retryAfter: '20',
    });
    expect(failure).toMatchObject({ kind: 'RetryAfter', seconds: 20 });
  });

  it('400 por el parámetro thinking rechazado → Permanent', () => {
    const failure = classifyAnthropicError({
      status: 400,
      body: {
        type: 'error',
        error: {
          type: 'invalid_request_error',
          message: '"thinking.type.disabled" is not supported for this model',
        },
      },
    });
    expect(failure.kind).toBe('Permanent');
  });

  it('402 billing_error → BudgetExhausted sin resetAt', () => {
    const failure = classifyAnthropicError({
      status: 402,
      body: { type: 'error', error: { type: 'billing_error', message: 'x' } },
    });
    expect(failure.kind).toBe('BudgetExhausted');
  });

  it('un 400 por un parámetro inválido → Permanent', () => {
    const failure = classifyAnthropicError({
      status: 400,
      body: { type: 'error', error: { type: 'invalid_request_error', message: 'max_tokens: x' } },
    });
    expect(failure.kind).toBe('Permanent');
  });

  it('429 común con retry-after → RetryAfter', () => {
    const failure = classifyAnthropicError({
      status: 429,
      body: { type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } },
      retryAfter: '17',
    });
    expect(failure).toMatchObject({ kind: 'RetryAfter', seconds: 17 });
  });

  it('429 común sin retry-after → Transient', () => {
    expect(
      classifyAnthropicError({
        status: 429,
        body: { type: 'error', error: { type: 'rate_limit_error', message: 'x' } },
      }).kind,
    ).toBe('Transient');
  });

  it.each([500, 529])('%i → Transient', (status) => {
    expect(classifyAnthropicError({ status }).kind).toBe('Transient');
  });

  it('error de red → Transient', () => {
    expect(classifyAnthropicError({}).kind).toBe('Transient');
  });

  it('401 → Permanent', () => {
    expect(classifyAnthropicError({ status: 401 }).kind).toBe('Permanent');
  });
});

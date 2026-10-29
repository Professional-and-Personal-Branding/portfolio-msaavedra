import { describe, expect, it } from 'vitest';
import { certificationValidity } from './certification-validity';

describe('certificationValidity', () => {
  const now = new Date(2026, 9, 29); // 29 de octubre de 2026, hora local

  it.each([
    [null, 'none'],
    [undefined, 'none'],
    ['', 'none'],
    ['no es fecha', 'none'],
    ['2026-10', 'valid'], // vence al terminar octubre: hoy sigue vigente
    ['2026-09', 'expired'],
    ['2026', 'valid'],
    ['2025', 'expired'],
    ['2029-06', 'valid'],
    ['2027-01', 'valid'],
  ] as const)('%s → %s', (expiresAt, expected) => {
    expect(certificationValidity(expiresAt, now)).toBe(expected);
  });

  it('el último día del mes de vencimiento todavía es válida y el primero del siguiente, no', () => {
    expect(certificationValidity('2026-10', new Date(2026, 9, 31))).toBe('valid');
    expect(certificationValidity('2026-10', new Date(2026, 10, 1))).toBe('expired');
    expect(certificationValidity('2026', new Date(2026, 11, 31))).toBe('valid');
    expect(certificationValidity('2026', new Date(2027, 0, 1))).toBe('expired');
  });
});

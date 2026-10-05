import { parseRangeEnd, parseRangeStart } from './range-boundaries';

describe('parseRangeStart', () => {
  it('una fecha sin hora es la medianoche de ese día en UTC', () => {
    expect(parseRangeStart('2026-10-05')?.toISOString()).toBe('2026-10-05T00:00:00.000Z');
  });

  it('un instante completo se respeta', () => {
    expect(parseRangeStart('2026-10-05T14:30:00Z')?.toISOString()).toBe('2026-10-05T14:30:00.000Z');
  });

  it('sin valor no hay límite', () => {
    expect(parseRangeStart(undefined)).toBeUndefined();
  });
});

describe('parseRangeEnd (defecto D-01)', () => {
  it('una fecha sin hora cubre el día entero: el rango es cerrado', () => {
    expect(parseRangeEnd('2026-10-05')?.toISOString()).toBe('2026-10-05T23:59:59.999Z');
  });

  it('un rango de un solo día contiene cualquier visita de ese día', () => {
    const from = parseRangeStart('2026-10-05')!;
    const to = parseRangeEnd('2026-10-05')!;
    const visita = new Date('2026-10-05T18:42:11Z');
    expect(visita >= from && visita <= to).toBe(true);
  });

  it('un instante completo se respeta, para ventanas más finas que un día', () => {
    expect(parseRangeEnd('2026-10-05T14:30:00Z')?.toISOString()).toBe('2026-10-05T14:30:00.000Z');
  });

  it('sin valor no hay límite', () => {
    expect(parseRangeEnd(undefined)).toBeUndefined();
  });
});

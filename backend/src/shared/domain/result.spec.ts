import { fail, isFail, isOk, mapResult, ok } from './result';

describe('Result', () => {
  it('ok() produce un resultado exitoso con el valor', () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    expect(isOk(r)).toBe(true);
    expect(isFail(r)).toBe(false);
    expect(r.value).toBe(42);
  });

  it('fail() produce un resultado fallido con el error', () => {
    const err = new Error('boom');
    const r = fail(err);
    expect(r.ok).toBe(false);
    expect(isFail(r)).toBe(true);
    expect(r.error).toBe(err);
  });

  it('mapResult transforma solo el valor exitoso', () => {
    expect(mapResult(ok(2), (v) => v * 10)).toEqual(ok(20));
    const failed = fail('e');
    expect(mapResult(failed, (v: number) => v * 10)).toBe(failed);
  });
});

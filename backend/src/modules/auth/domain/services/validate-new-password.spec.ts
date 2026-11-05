import { ValidationError } from '../../../../shared/domain/errors';
import { PASSWORD_MAX, PASSWORD_MIN, validateNewPassword } from './validate-new-password';

const CURRENT = 'la-actual-de-prueba';

describe('validateNewPassword (change add-admin-password-change, D2)', () => {
  it('los topes son 12 y 256', () => {
    expect(PASSWORD_MIN).toBe(12);
    expect(PASSWORD_MAX).toBe(256);
  });

  it('rechaza 11 caracteres y acepta 12', () => {
    const short = validateNewPassword('a'.repeat(11), CURRENT);
    expect(short.ok).toBe(false);
    if (!short.ok) {
      expect(short.error).toBeInstanceOf(ValidationError);
      expect(short.error.fields).toEqual(['newPassword']);
    }
    expect(validateNewPassword('a'.repeat(12), CURRENT).ok).toBe(true);
  });

  it('acepta 256 y rechaza 257', () => {
    expect(validateNewPassword('a'.repeat(256), CURRENT).ok).toBe(true);
    expect(validateNewPassword('a'.repeat(257), CURRENT).ok).toBe(false);
  });

  it('rechaza la igual a la actual', () => {
    const same = validateNewPassword(CURRENT, CURRENT);
    expect(same.ok).toBe(false);
    if (!same.ok) expect(same.error.message).toMatch(/distinta de la actual/);
  });

  it('cuenta puntos de código: acentos y emojis valen 1', () => {
    expect(validateNewPassword('ñ'.repeat(12), CURRENT).ok).toBe(true);
    expect(validateNewPassword('😀'.repeat(12), CURRENT).ok).toBe(true);
    expect(validateNewPassword('😀'.repeat(11), CURRENT).ok).toBe(false);
    expect(validateNewPassword('😀'.repeat(256), CURRENT).ok).toBe(true);
    expect(validateNewPassword('😀'.repeat(257), CURRENT).ok).toBe(false);
  });

  it('no recorta espacios', () => {
    expect(validateNewPassword(' ' + 'a'.repeat(11), CURRENT).ok).toBe(true);
    expect(validateNewPassword(' ' + 'a'.repeat(10) + ' ', CURRENT).ok).toBe(true);
    expect(validateNewPassword(' '.repeat(12), CURRENT).ok).toBe(true);
  });

  it('distinta por un espacio final ya cuenta como distinta', () => {
    expect(validateNewPassword(CURRENT + ' ', CURRENT).ok).toBe(true);
  });
});

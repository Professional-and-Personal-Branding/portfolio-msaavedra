import { describe, expect, it } from 'vitest';
import { passwordErrorMessage, passwordFormSchema, type PasswordFormValues } from './password-form';

const VALID: PasswordFormValues = {
  currentPassword: 'la-actual-de-prueba',
  newPassword: 'una-nueva-bien-larga',
  confirmPassword: 'una-nueva-bien-larga',
};

function messages(values: Partial<PasswordFormValues>): Record<string, string> {
  const result = passwordFormSchema.safeParse({ ...VALID, ...values });
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
  );
}

describe('passwordFormSchema', () => {
  it('acepta una combinación válida', () => {
    expect(passwordFormSchema.safeParse(VALID).success).toBe(true);
  });

  it('11 caracteres → «Usá al menos 12 caracteres»', () => {
    expect(messages({ newPassword: 'a'.repeat(11), confirmPassword: 'a'.repeat(11) })).toEqual({
      newPassword: 'Usá al menos 12 caracteres',
    });
  });

  it('257 caracteres → «Usá como máximo 256 caracteres»', () => {
    const long = 'a'.repeat(257);
    expect(messages({ newPassword: long, confirmPassword: long }).newPassword).toBe(
      'Usá como máximo 256 caracteres',
    );
    expect(messages({ currentPassword: long }).currentPassword).toBe(
      'Usá como máximo 256 caracteres',
    );
  });

  it('repetición distinta → «Las contraseñas no coinciden»', () => {
    expect(messages({ confirmPassword: 'otra-distinta-larga' })).toEqual({
      confirmPassword: 'Las contraseñas no coinciden',
    });
  });

  it('igual a la actual → «La nueva contraseña tiene que ser distinta de la actual»', () => {
    const same = VALID.currentPassword.padEnd(12, 'x');
    expect(
      messages({ currentPassword: same, newPassword: same, confirmPassword: same }).newPassword,
    ).toBe('La nueva contraseña tiene que ser distinta de la actual');
  });

  it('actual vacía → «Escribí tu contraseña actual»', () => {
    expect(messages({ currentPassword: '' }).currentPassword).toBe('Escribí tu contraseña actual');
  });

  it('cuenta puntos de código: 12 emojis valen, 11 no', () => {
    const twelve = '😀'.repeat(12);
    expect(messages({ newPassword: twelve, confirmPassword: twelve })).toEqual({});
    const eleven = '😀'.repeat(11);
    expect(messages({ newPassword: eleven, confirmPassword: eleven }).newPassword).toBe(
      'Usá al menos 12 caracteres',
    );
  });

  it('no recorta espacios: un espacio inicial más 11 letras son 12', () => {
    const value = ` ${'a'.repeat(11)}`;
    expect(messages({ newPassword: value, confirmPassword: value })).toEqual({});
  });
});

describe('passwordErrorMessage', () => {
  it('traduce el status de la API', () => {
    expect(passwordErrorMessage(401)).toBe('La contraseña actual no es correcta');
    expect(passwordErrorMessage(400)).toBe(
      'La API rechazó la contraseña nueva. Revisá las reglas.',
    );
    expect(passwordErrorMessage(429)).toBe('Demasiados intentos. Probá de nuevo en unos minutos.');
    expect(passwordErrorMessage(500)).toBe('No pudimos contactar al servidor. Intentá de nuevo.');
    expect(passwordErrorMessage(undefined)).toBe(
      'No pudimos contactar al servidor. Intentá de nuevo.',
    );
  });
});

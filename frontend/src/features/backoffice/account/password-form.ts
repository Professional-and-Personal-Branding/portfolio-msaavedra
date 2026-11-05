import { z } from 'zod';

/** Mismos topes que la API (`validateNewPassword`): puntos de código, no unidades UTF-16. */
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 256;

const codePoints = (value: string): number => [...value].length;

export const MESSAGES = {
  currentRequired: 'Escribí tu contraseña actual',
  tooShort: 'Usá al menos 12 caracteres',
  tooLong: 'Usá como máximo 256 caracteres',
  sameAsCurrent: 'La nueva contraseña tiene que ser distinta de la actual',
  mismatch: 'Las contraseñas no coinciden',
} as const;

/**
 * Reglas del formulario *Cambiar contraseña* (change `add-admin-password-change`, D11). No recorta
 * ni normaliza espacios: la contraseña viaja tal como se escribió.
 */
export const passwordFormSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, MESSAGES.currentRequired)
      .refine((value) => codePoints(value) <= PASSWORD_MAX, MESSAGES.tooLong),
    newPassword: z
      .string()
      .refine((value) => codePoints(value) >= PASSWORD_MIN, MESSAGES.tooShort)
      .refine((value) => codePoints(value) <= PASSWORD_MAX, MESSAGES.tooLong),
    confirmPassword: z.string(),
  })
  .superRefine((values, context) => {
    if (values.newPassword === values.currentPassword) {
      context.addIssue({
        code: 'custom',
        path: ['newPassword'],
        message: MESSAGES.sameAsCurrent,
      });
    }
    if (values.confirmPassword !== values.newPassword) {
      context.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: MESSAGES.mismatch,
      });
    }
  });

export type PasswordFormValues = z.infer<typeof passwordFormSchema>;

export const EMPTY_PASSWORD_FORM: PasswordFormValues = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

/** Mensaje del formulario según el estado de la API (D11). */
export function passwordErrorMessage(status: number | undefined): string {
  switch (status) {
    case 401:
      return 'La contraseña actual no es correcta';
    case 400:
      return 'La API rechazó la contraseña nueva. Revisá las reglas.';
    case 429:
      return 'Demasiados intentos. Probá de nuevo en unos minutos.';
    default:
      return 'No pudimos contactar al servidor. Intentá de nuevo.';
  }
}

export const PASSWORD_CHANGED_MESSAGE =
  'Contraseña actualizada. Se cerraron las sesiones de otros dispositivos.';

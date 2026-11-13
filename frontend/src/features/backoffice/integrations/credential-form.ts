import { z } from 'zod';

/** Mismo tope que la API (`SaveCredentialDto`): unidades de texto, igual que `@MaxLength`. */
export const CREDENTIAL_MAX = 4096;

export const CREDENTIAL_MESSAGES = {
  required: 'Ingresá la credencial.',
  tooLong: 'La credencial no puede superar 4096 caracteres.',
  edgeSpaces: 'La credencial no puede empezar ni terminar con espacios.',
} as const;

/**
 * Regla del campo *Credencial* (change `add-integrations-foundation`, D19). No recorta: la
 * credencial viaja tal como se escribió, y la API rechaza los espacios al borde, así que se
 * avisa antes.
 */
export const credentialFormSchema = z.object({
  secret: z
    .string()
    .refine((value) => value.trim().length > 0, CREDENTIAL_MESSAGES.required)
    .refine((value) => value.length <= CREDENTIAL_MAX, CREDENTIAL_MESSAGES.tooLong)
    .refine((value) => value === value.trim(), CREDENTIAL_MESSAGES.edgeSpaces),
});

export type CredentialFormValues = z.infer<typeof credentialFormSchema>;

export const EMPTY_CREDENTIAL_FORM: CredentialFormValues = { secret: '' };

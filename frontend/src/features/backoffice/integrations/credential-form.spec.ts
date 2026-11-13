import { describe, expect, it } from 'vitest';
import { CREDENTIAL_MESSAGES, credentialFormSchema } from './credential-form';

const messageOf = (secret: string): string | undefined =>
  credentialFormSchema.safeParse({ secret }).error?.issues[0]?.message;

describe('credentialFormSchema', () => {
  it('vacío → «Ingresá la credencial.»', () => {
    expect(messageOf('')).toBe('Ingresá la credencial.');
  });

  it('solo espacios → «Ingresá la credencial.»', () => {
    expect(messageOf('    ')).toBe(CREDENTIAL_MESSAGES.required);
  });

  it('4096 caracteres es válido', () => {
    expect(credentialFormSchema.safeParse({ secret: 'x'.repeat(4096) }).success).toBe(true);
  });

  it('4097 caracteres → «La credencial no puede superar 4096 caracteres.»', () => {
    expect(messageOf('x'.repeat(4097))).toBe('La credencial no puede superar 4096 caracteres.');
  });

  it('espacios al borde se rechazan antes de llegar a la API', () => {
    expect(messageOf(' token')).toBe(CREDENTIAL_MESSAGES.edgeSpaces);
    expect(messageOf('token ')).toBe(CREDENTIAL_MESSAGES.edgeSpaces);
  });

  it('un valor con espacios en el medio es válido', () => {
    expect(credentialFormSchema.safeParse({ secret: 'a b c' }).success).toBe(true);
  });
});

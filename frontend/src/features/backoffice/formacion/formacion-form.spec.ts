import { describe, expect, it } from 'vitest';
import {
  certificationSchema,
  EMPTY_CERTIFICATION,
  fieldErrors,
  isHttpsUrl,
  toCertificationBody,
  toCertificationValues,
  type CertificationFormValues,
} from './formacion-form';

// add-certification-verification (D3, D8): las reglas del panel repiten las del dominio.
const VALID: CertificationFormValues = {
  ...EMPTY_CERTIFICATION,
  name: { es: 'Nube', en: '' },
  issuer: 'Escuela Demo',
  year: '2023',
};

describe('isHttpsUrl', () => {
  it('acepta https con dominio y rechaza el resto', () => {
    expect(isHttpsUrl('https://example.org/c/1')).toBe(true);
    for (const value of [
      'http://example.org',
      'javascript:alert(1)',
      'data:text/html,x',
      '/c/1',
      'example.org/c/1',
      'https://localhost/c',
    ]) {
      expect(isHttpsUrl(value)).toBe(false);
    }
  });
});

describe('certificationSchema · credencial', () => {
  it('acepta la certificación sin credencial y con la credencial completa', () => {
    expect(fieldErrors(certificationSchema, VALID)).toEqual({});
    expect(
      fieldErrors(certificationSchema, {
        ...VALID,
        verificationUrl: 'https://example.org/credenciales/1',
        credentialId: 'EJ-2023-0042',
        expiresAt: '2029-06',
      }),
    ).toEqual({});
    expect(fieldErrors(certificationSchema, { ...VALID, expiresAt: '2023' })).toEqual({});
  });

  it.each([
    [
      { verificationUrl: 'http://example.org/c/1' },
      'verificationUrl',
      'Usá una URL completa que empiece con https://',
    ],
    [
      { verificationUrl: `https://example.org/${'a'.repeat(2049)}` },
      'verificationUrl',
      'Usá una URL completa que empiece con https://',
    ],
    [
      { credentialId: 'x'.repeat(101) },
      'credentialId',
      'El ID de credencial admite hasta 100 caracteres',
    ],
    [{ expiresAt: '06/2029' }, 'expiresAt', 'Usá el formato AAAA-MM o AAAA'],
    [{ expiresAt: '2029-13' }, 'expiresAt', 'Usá el formato AAAA-MM o AAAA'],
    [{ expiresAt: '2022-12' }, 'expiresAt', 'El vencimiento no puede ser anterior al año'],
  ] as const)('rechaza %o', (changes, field, message) => {
    expect(fieldErrors(certificationSchema, { ...VALID, ...changes })).toEqual({
      [field]: message,
    });
  });

  it('sin año, cualquier vencimiento bien formado es válido', () => {
    expect(fieldErrors(certificationSchema, { ...VALID, year: '', expiresAt: '2001-01' })).toEqual(
      {},
    );
  });
});

describe('valores ↔ cuerpo de la certificación', () => {
  it('vacío se envía como null y el texto va recortado', () => {
    expect(toCertificationBody(VALID)).toMatchObject({
      verificationUrl: null,
      credentialId: null,
      expiresAt: null,
    });
    expect(
      toCertificationBody({
        ...VALID,
        verificationUrl: '  https://example.org/c/1 ',
        credentialId: ' EJ-1 ',
        expiresAt: ' 2029-06 ',
      }),
    ).toMatchObject({
      verificationUrl: 'https://example.org/c/1',
      credentialId: 'EJ-1',
      expiresAt: '2029-06',
    });
  });

  it('null se muestra como campo vacío', () => {
    const values = toCertificationValues({
      id: 'c1',
      name: { es: 'Nube' },
      issuer: 'X',
      year: null,
      verificationUrl: null,
      credentialId: null,
      expiresAt: null,
      order: 0,
      visible: true,
    });
    expect(values).toMatchObject({ verificationUrl: '', credentialId: '', expiresAt: '' });
  });
});

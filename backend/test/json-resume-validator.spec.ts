import {
  declaredJsonResumeSchemaSha256,
  jsonResumeSchemaSha256,
  validateJsonResume,
} from './support/json-resume-validator';

const MINIMO = {
  $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
  basics: { name: 'Ada Ejemplo', email: 'ada@ejemplo.dev', url: 'https://ejemplo.dev/' },
  meta: { version: 'v1.0.0', lastModified: '2026-01-15T12:00:00' },
};

describe('validador de JSON Resume v1.0.0', () => {
  it('el SHA-256 del schema vendorizado coincide con el de SOURCE.md', () => {
    expect(declaredJsonResumeSchemaSha256()).not.toBeNull();
    expect(jsonResumeSchemaSha256()).toBe(declaredJsonResumeSchemaSha256());
  });

  it('acepta un documento mínimo válido', () => {
    const result = validateJsonResume(MINIMO);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('rechaza certificates[].date con solo el año (el formato `date` está activo)', () => {
    const result = validateJsonResume({
      ...MINIMO,
      certificates: [{ name: 'Certificación', issuer: 'Emisor', date: '2023' }],
    });
    expect(result.valid).toBe(false);
  });

  it('acepta certificates[].date con fecha completa', () => {
    const result = validateJsonResume({
      ...MINIMO,
      certificates: [{ name: 'Certificación', date: '2023-05-01' }],
    });
    expect(result.valid).toBe(true);
  });

  it('rechaza una clave de raíz desconocida', () => {
    expect(validateJsonResume({ ...MINIMO, 'x-extra': {} }).valid).toBe(false);
  });

  it('rechaza una URL y un email mal formados (formatos uri y email activos)', () => {
    expect(
      validateJsonResume({ ...MINIMO, basics: { name: 'A', url: 'no es una url' } }).valid,
    ).toBe(false);
    expect(
      validateJsonResume({ ...MINIMO, basics: { name: 'A', email: 'sin-arroba' } }).valid,
    ).toBe(false);
  });

  it('rechaza una fecha que no cumple iso8601', () => {
    const result = validateJsonResume({
      ...MINIMO,
      work: [{ name: 'Empresa', startDate: 'enero 2020' }],
    });
    expect(result.valid).toBe(false);
  });
});

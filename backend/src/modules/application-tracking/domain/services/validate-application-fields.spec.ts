import { validateApplicationFields } from './validate-application-fields';

const OK = { company: 'Globex', role: 'Backend Senior' };

describe('validateApplicationFields (D2)', () => {
  it('recorta y devuelve nulos para lo opcional vacío', () => {
    const result = validateApplicationFields({
      company: '  Globex ',
      role: ' Backend Senior  ',
      jobUrl: '  ',
      portal: '',
      notes: '   ',
    });
    expect(result).toEqual({
      ok: true,
      value: { company: 'Globex', role: 'Backend Senior', jobUrl: null, portal: null, notes: null },
    });
  });

  it('empresa: 120 caracteres pasa y 121 no; vacía no', () => {
    expect(validateApplicationFields({ ...OK, company: 'a'.repeat(120) }).ok).toBe(true);
    expect(validateApplicationFields({ ...OK, company: 'a'.repeat(121) }).ok).toBe(false);
    expect(validateApplicationFields({ ...OK, company: '   ' }).ok).toBe(false);
  });

  it('el límite cuenta tras recortar', () => {
    expect(validateApplicationFields({ ...OK, company: ` ${'a'.repeat(120)} ` }).ok).toBe(true);
  });

  it('puesto: 160 pasa y 161 no; vacío no', () => {
    expect(validateApplicationFields({ ...OK, role: 'a'.repeat(160) }).ok).toBe(true);
    expect(validateApplicationFields({ ...OK, role: 'a'.repeat(161) }).ok).toBe(false);
    expect(validateApplicationFields({ ...OK, role: '' }).ok).toBe(false);
  });

  it('notas: 5000 pasa y 5001 no', () => {
    expect(validateApplicationFields({ ...OK, notes: 'a'.repeat(5000) }).ok).toBe(true);
    expect(validateApplicationFields({ ...OK, notes: 'a'.repeat(5001) }).ok).toBe(false);
  });

  it('URL: acepta http y https; rechaza ftp, relativa y sin esquema', () => {
    expect(validateApplicationFields({ ...OK, jobUrl: 'https://globex.example/jobs/1' }).ok).toBe(
      true,
    );
    expect(validateApplicationFields({ ...OK, jobUrl: 'http://globex.example' }).ok).toBe(true);
    for (const jobUrl of ['ftp://x.example', '/jobs/1', 'globex.example', 'javascript:alert(1)']) {
      const result = validateApplicationFields({ ...OK, jobUrl });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.fields).toEqual(['jobUrl']);
    }
  });

  it('URL: 2048 caracteres pasa y 2049 no', () => {
    const base = 'https://globex.example/';
    expect(
      validateApplicationFields({ ...OK, jobUrl: base + 'a'.repeat(2048 - base.length) }).ok,
    ).toBe(true);
    expect(
      validateApplicationFields({ ...OK, jobUrl: base + 'a'.repeat(2049 - base.length) }).ok,
    ).toBe(false);
  });

  it('portal: se normaliza a minúsculas; uno inválido es error, no se descarta', () => {
    const good = validateApplicationFields({ ...OK, portal: ' LinkedIn ' });
    expect(good.ok && good.value.portal).toBe('linkedin');
    for (const portal of ['mi portal!', '-x', 'a'.repeat(33)]) {
      const result = validateApplicationFields({ ...OK, portal });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.fields).toEqual(['portal']);
    }
  });
});

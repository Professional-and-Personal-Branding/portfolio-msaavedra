import * as fs from 'fs';
import * as path from 'path';
import { NewCertificationProps } from '../entities/certification.entity';
import { validateCertification } from './validate-certification';

const VALID: NewCertificationProps = {
  name: { es: 'Scrum Master', en: 'Scrum Master' },
  issuer: 'UAGRM School of Engineering',
  year: '2022',
  verificationUrl: null,
  credentialId: null,
  expiresAt: null,
  order: 0,
  visible: true,
};

describe('validateCertification', () => {
  it('acepta una certificación con año y una sin año', () => {
    expect(validateCertification(VALID).ok).toBe(true);
    expect(validateCertification({ ...VALID, year: null }).ok).toBe(true);
  });

  it('acepta la credencial completa y cada campo por separado', () => {
    const full = {
      ...VALID,
      verificationUrl: 'https://example.org/credenciales/1',
      credentialId: 'EJ-2023-0042',
      expiresAt: '2029-06',
    };
    expect(validateCertification(full).ok).toBe(true);
    expect(validateCertification({ ...VALID, verificationUrl: full.verificationUrl }).ok).toBe(
      true,
    );
    expect(validateCertification({ ...VALID, credentialId: 'x'.repeat(100) }).ok).toBe(true);
    expect(validateCertification({ ...VALID, expiresAt: '2029' }).ok).toBe(true);
    expect(validateCertification({ ...VALID, year: '2023', expiresAt: '2023' }).ok).toBe(true);
    expect(validateCertification({ ...VALID, year: null, expiresAt: '2001-01' }).ok).toBe(true);
    const maxUrl = `https://example.org/${'a'.repeat(2048 - 'https://example.org/'.length)}`;
    expect(validateCertification({ ...VALID, verificationUrl: maxUrl }).ok).toBe(true);
  });

  it.each([
    [{ issuer: '' }, 'issuer'],
    [{ name: { es: '  ' } }, 'name'],
    [{ name: { en: 'Scrum Master' } }, 'name'],
    [{ year: '22' }, 'year'],
    [{ year: '2022-05' }, 'year'],
    [{ year: '' }, 'year'],
    [{ verificationUrl: 'http://example.org/c/1' }, 'verificationUrl'],
    [{ verificationUrl: 'javascript:alert(1)' }, 'verificationUrl'],
    [{ verificationUrl: '/c/1' }, 'verificationUrl'],
    [{ verificationUrl: `https://example.org/${'a'.repeat(2049)}` }, 'verificationUrl'],
    [{ credentialId: '' }, 'credentialId'],
    [{ credentialId: '   ' }, 'credentialId'],
    [{ credentialId: 'x'.repeat(101) }, 'credentialId'],
    [{ expiresAt: '2029-13' }, 'expiresAt'],
    [{ expiresAt: '06/2029' }, 'expiresAt'],
    [{ expiresAt: '29' }, 'expiresAt'],
    [{ expiresAt: '2022-12', year: '2023' }, 'expiresAt'],
  ])('rechaza %o', (changes, field) => {
    const result = validateCertification({ ...VALID, ...changes });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.fields).toEqual([field]);
  });

  it('acepta todas las certificaciones del seed (docs/cv-data.json)', () => {
    const file = path.resolve(__dirname, '../../../../../../docs/cv-data.json');
    const seed = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
      certifications: Partial<Omit<NewCertificationProps, 'order' | 'visible'>>[];
    };
    expect(seed.certifications.length).toBeGreaterThan(0);
    for (const [order, item] of seed.certifications.entries()) {
      expect(validateCertification({ ...VALID, ...item, order, visible: true })).toEqual({
        ok: true,
        value: undefined,
      });
    }
  });
});

import * as fs from 'fs';
import * as path from 'path';
import { NewCertificationProps } from '../entities/certification.entity';
import { validateCertification } from './validate-certification';

const VALID: NewCertificationProps = {
  name: { es: 'Scrum Master', en: 'Scrum Master' },
  issuer: 'UAGRM School of Engineering',
  year: '2022',
  order: 0,
  visible: true,
};

describe('validateCertification', () => {
  it('acepta una certificación con año y una sin año', () => {
    expect(validateCertification(VALID).ok).toBe(true);
    expect(validateCertification({ ...VALID, year: null }).ok).toBe(true);
  });

  it.each([
    [{ issuer: '' }, 'issuer'],
    [{ name: { es: '  ' } }, 'name'],
    [{ name: { en: 'Scrum Master' } }, 'name'],
    [{ year: '22' }, 'year'],
    [{ year: '2022-05' }, 'year'],
    [{ year: '' }, 'year'],
  ])('rechaza %o', (changes, field) => {
    const result = validateCertification({ ...VALID, ...changes });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.fields).toEqual([field]);
  });

  it('acepta todas las certificaciones del seed (docs/cv-data.json)', () => {
    const file = path.resolve(__dirname, '../../../../../../docs/cv-data.json');
    const seed = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
      certifications: Omit<NewCertificationProps, 'order' | 'visible'>[];
    };
    expect(seed.certifications.length).toBeGreaterThan(0);
    for (const [order, item] of seed.certifications.entries()) {
      expect(validateCertification({ ...item, order, visible: true })).toEqual({
        ok: true,
        value: undefined,
      });
    }
  });
});

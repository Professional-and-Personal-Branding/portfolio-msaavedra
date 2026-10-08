import * as fs from 'fs';
import * as path from 'path';
import { NewEducationProps } from '../entities/education.entity';
import { validateEducation } from './validate-education';

const VALID: NewEducationProps = {
  degree: { es: 'Ingeniería de Sistemas', en: "Bachelor's in Systems Engineering" },
  institution: 'UAGRM',
  startDate: '2012-03',
  endDate: '2020-06',
  inProgress: false,
  order: 0,
  visible: true,
};

describe('validateEducation', () => {
  it('acepta una formación terminada y una en curso sin endDate', () => {
    expect(validateEducation(VALID).ok).toBe(true);
    expect(validateEducation({ ...VALID, endDate: null, inProgress: true }).ok).toBe(true);
  });

  it('acepta fechas solo con año y mezcla de precisiones del mismo período', () => {
    expect(validateEducation({ ...VALID, startDate: '2012', endDate: '2020' }).ok).toBe(true);
    expect(validateEducation({ ...VALID, startDate: '2021-03', endDate: '2021' }).ok).toBe(true);
    expect(validateEducation({ ...VALID, startDate: '2021', endDate: '2021-01' }).ok).toBe(true);
  });

  it('acepta un título plano legado', () => {
    expect(validateEducation({ ...VALID, degree: 'Ingeniería' }).ok).toBe(true);
  });

  it.each([
    [{ institution: '  ' }, ['institution']],
    [{ degree: { es: ' ', en: 'Degree' } }, ['degree']],
    [{ degree: { en: 'Degree' } }, ['degree']],
    [{ degree: '' }, ['degree']],
    [{ startDate: '2024-13' }, ['startDate']],
    [{ startDate: 'marzo 2012' }, ['startDate']],
    [{ startDate: '2012-3' }, ['startDate']],
    [{ endDate: '20-06' }, ['endDate']],
    [{ inProgress: true }, ['inProgress', 'endDate']],
    [{ startDate: '2021-02', endDate: '2020-06' }, ['startDate', 'endDate']],
    [{ startDate: '2022', endDate: '2021-12' }, ['startDate', 'endDate']],
  ])('rechaza %o', (changes, fields) => {
    const result = validateEducation({ ...VALID, ...changes });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.fields).toEqual(fields);
  });

  it('acepta todas las formaciones del seed (docs/cv-data.json)', () => {
    const file = path.resolve(__dirname, '../../../../../../docs/cv-data.json');
    const seed = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
      education: Omit<NewEducationProps, 'order' | 'visible'>[];
    };
    expect(seed.education.length).toBeGreaterThan(0);
    for (const [order, item] of seed.education.entries()) {
      expect(validateEducation({ ...item, order, visible: true })).toEqual({
        ok: true,
        value: undefined,
      });
    }
  });
});

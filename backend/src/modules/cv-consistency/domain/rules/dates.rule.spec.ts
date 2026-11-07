import { AS_OF, cleanSnapshot } from '../cv-rules.seeded.fixture';
import { CvSnapshot } from '../cv-snapshot';
import { datesRule } from './dates.rule';

const ctx = { asOf: AS_OF };
const withExperience = (changes: Record<string, unknown>, id = 'exp-a'): CvSnapshot => {
  const s = cleanSnapshot();
  return {
    ...s,
    experiences: s.experiences.map((e) => (e.id === id ? { ...e, ...changes } : e)),
  };
};
const withEducation = (changes: Record<string, unknown>): CvSnapshot => {
  const s = cleanSnapshot();
  return { ...s, education: s.education.map((e) => ({ ...e, ...changes })) };
};
const withCertification = (changes: Record<string, unknown>): CvSnapshot => {
  const s = cleanSnapshot();
  return { ...s, certifications: s.certifications.map((c) => ({ ...c, ...changes })) };
};
const codes = (snapshot: CvSnapshot) =>
  datesRule(snapshot, ctx).map((i) => `${i.code}:${i.entityType}:${i.field}`);

describe('datesRule', () => {
  it('el CV limpio no emite nada', () => {
    expect(datesRule(cleanSnapshot(), ctx)).toEqual([]);
  });

  describe('date.invalid-format', () => {
    it.each([
      ['2024-13', 'startDate'],
      ['2024-1', 'startDate'],
      ['mayo 2024', 'startDate'],
    ])('experiencia con startDate %s', (value, field) => {
      expect(codes(withExperience({ startDate: value }))).toEqual([
        `date.invalid-format:experience:${field}`,
      ]);
    });

    it('experiencia con endDate inválido (y sin end-before-start)', () => {
      expect(codes(withExperience({ endDate: '2020' }))).toEqual([
        'date.invalid-format:experience:endDate',
      ]);
    });

    it('una experiencia oculta con fecha rota también se reporta', () => {
      expect(codes(withExperience({ startDate: '2024-13', visible: false }))).toEqual([
        'date.invalid-format:experience:startDate',
      ]);
    });

    it('formación acepta YYYY y YYYY-MM y rechaza lo demás', () => {
      expect(codes(withEducation({ startDate: '2008', endDate: '2013' }))).toEqual([]);
      expect(codes(withEducation({ startDate: '2008-3' }))).toEqual([
        'date.invalid-format:education:startDate',
      ]);
      expect(codes(withEducation({ endDate: '13/2013' }))).toEqual([
        'date.invalid-format:education:endDate',
      ]);
    });

    it('certificación: year y expiresAt', () => {
      expect(codes(withCertification({ year: '22' }))).toEqual([
        'date.invalid-format:certification:year',
      ]);
      expect(codes(withCertification({ expiresAt: '2029-13' }))).toEqual([
        'date.invalid-format:certification:expiresAt',
      ]);
      expect(codes(withCertification({ expiresAt: '2029', year: null }))).toEqual([]);
    });

    it('params: el valor y el formato esperado', () => {
      const [found] = datesRule(withExperience({ startDate: '2024-13' }), ctx);
      expect(found.params).toEqual({ expected: 'AAAA-MM', value: '2024-13' });
      expect(found.severity).toBe('error');
    });
  });

  describe('date.end-before-start', () => {
    it('experiencia con fin anterior al inicio', () => {
      const [found] = datesRule(withExperience({ endDate: '2014-05' }), ctx);
      expect(found).toMatchObject({
        code: 'date.end-before-start',
        severity: 'error',
        entityType: 'experience',
        entityId: 'exp-a',
        params: { start: '2015-01', end: '2014-05' },
      });
    });

    it('un solo mes (inicio = fin) es válido', () => {
      expect(codes(withExperience({ startDate: '2020-05', endDate: '2020-05' }))).toEqual([]);
    });

    it('formación compara a la menor precisión', () => {
      expect(codes(withEducation({ startDate: '2021-03', endDate: '2021' }))).toEqual([]);
      expect(codes(withEducation({ startDate: '2022', endDate: '2021-12' }))).toEqual([
        'date.end-before-start:education:endDate',
      ]);
    });
  });

  describe('date.ongoing-with-end', () => {
    it('experiencia current con fin', () => {
      expect(codes(withExperience({ current: true, endDate: '2024-05' }))).toEqual([
        'date.ongoing-with-end:experience:endDate',
      ]);
    });

    it('formación en curso con fin', () => {
      expect(codes(withEducation({ inProgress: true }))).toEqual([
        'date.ongoing-with-end:education:endDate',
      ]);
    });

    it('current sin fin está bien', () => {
      expect(codes(withExperience({ current: true, endDate: null }))).toEqual([]);
    });
  });
});

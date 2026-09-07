import { toCertificationEntity, toEducationEntity } from './education.prisma-mapper';

describe('education prisma mappers', () => {
  it('mapea educación y certificación; JSON malformado → vacío', () => {
    const edu = toEducationEntity({
      id: 'e1',
      degree: { es: 'PhD', en: 'PhD' },
      institution: 'UAGRM',
      startDate: '2024-02',
      endDate: null,
      inProgress: true,
      order: 0,
      visible: true,
    });
    expect(edu.degree).toEqual({ es: 'PhD', en: 'PhD' });
    expect(edu.inProgress).toBe(true);

    const cert = toCertificationEntity({
      id: 'c1',
      name: [1] as never,
      issuer: 'X',
      year: '2021',
      order: 0,
      visible: true,
    });
    expect(cert.name).toEqual({});
    expect(cert.year).toBe('2021');
  });
});

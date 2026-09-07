import { toProjectEntity } from './project.prisma-mapper';

describe('toProjectEntity', () => {
  it('mapea el registro; JSON malformado → vacío', () => {
    const p = toProjectEntity({
      id: 'p1',
      name: 'ERP AWA',
      role: { es: 'Líder', en: 'Lead' },
      period: '2019-2020',
      summary: 42,
      technologies: ['Java'],
      tags: ['erp', 'java'],
      url: null,
      order: 1,
      visible: true,
    });
    expect(p.role).toEqual({ es: 'Líder', en: 'Lead' });
    expect(p.summary).toEqual({});
    expect(p.tags).toEqual(['erp', 'java']);
  });
});

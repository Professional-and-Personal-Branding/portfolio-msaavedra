import { Certification } from '../../domain/entities/certification.entity';
import { Education } from '../../domain/entities/education.entity';
import { ListCertificationsUseCase, ListEducationUseCase } from './education.use-cases';

const edu = (id: string, order: number, visible = true) =>
  Education.create({
    id,
    degree: { es: `Grado ${id}`, en: `Degree ${id}` },
    institution: 'UAGRM',
    startDate: '2024-02',
    endDate: null,
    inProgress: true,
    order,
    visible,
  });

const cert = (id: string, visible = true) =>
  Certification.create({ id, name: { es: 'Cert' }, issuer: 'X', year: null, order: 0, visible });

describe('ListEducationUseCase / ListCertificationsUseCase', () => {
  it('educación: resuelve locale, excluye ocultas, sin campo visible', async () => {
    const repo = { findAllVisible: jest.fn().mockResolvedValue([edu('a', 0), edu('h', 1, false)]) };
    const r = await new ListEducationUseCase(repo).execute({ locale: 'en' });
    expect(r.value).toEqual([
      {
        id: 'a',
        degree: 'Degree a',
        institution: 'UAGRM',
        startDate: '2024-02',
        endDate: null,
        inProgress: true,
        order: 0,
      },
    ]);
  });

  it('certificaciones: fallback a español y year nulo', async () => {
    const repo = { findAllVisible: jest.fn().mockResolvedValue([cert('c1')]) };
    const r = await new ListCertificationsUseCase(repo).execute({ locale: 'en' });
    expect(r.value).toEqual([{ id: 'c1', name: 'Cert', issuer: 'X', year: null, order: 0 }]);
  });
});

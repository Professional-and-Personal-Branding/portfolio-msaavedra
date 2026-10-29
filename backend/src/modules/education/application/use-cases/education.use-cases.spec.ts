import { Certification } from '../../domain/entities/certification.entity';
import { Education } from '../../domain/entities/education.entity';
import {
  CertificationRepository,
  EducationRepository,
} from '../../domain/repositories/education.repository';
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
  Certification.create({
    id,
    name: { es: 'Cert' },
    issuer: 'X',
    year: null,
    verificationUrl: null,
    credentialId: null,
    expiresAt: null,
    order: 0,
    visible,
  });

const credentialCert = Certification.create({
  id: 'c2',
  name: { es: 'Nube', en: 'Cloud' },
  issuer: 'X',
  year: '2023',
  verificationUrl: 'https://example.org/credenciales/1',
  credentialId: 'EJ-2023-0042',
  expiresAt: '2029-06',
  order: 1,
  visible: true,
});

describe('ListEducationUseCase / ListCertificationsUseCase', () => {
  it('educación: resuelve locale, excluye ocultas, sin campo visible', async () => {
    const repo = {
      findAllVisible: jest.fn().mockResolvedValue([edu('a', 0), edu('h', 1, false)]),
    } as unknown as EducationRepository;
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
    const repo = {
      findAllVisible: jest.fn().mockResolvedValue([cert('c1')]),
    } as unknown as CertificationRepository;
    const r = await new ListCertificationsUseCase(repo).execute({ locale: 'en' });
    expect(r.value).toEqual([
      {
        id: 'c1',
        name: 'Cert',
        issuer: 'X',
        year: null,
        verificationUrl: null,
        credentialId: null,
        expiresAt: null,
        order: 0,
      },
    ]);
  });

  it('certificaciones: devuelve el enlace, el ID y el vencimiento tal cual, sin campo expired', async () => {
    const repo = {
      findAllVisible: jest.fn().mockResolvedValue([credentialCert]),
    } as unknown as CertificationRepository;
    const r = await new ListCertificationsUseCase(repo).execute({ locale: 'en' });
    expect(r.value).toEqual([
      {
        id: 'c2',
        name: 'Cloud',
        issuer: 'X',
        year: '2023',
        verificationUrl: 'https://example.org/credenciales/1',
        credentialId: 'EJ-2023-0042',
        expiresAt: '2029-06',
        order: 1,
      },
    ]);
    expect(r.value[0]).not.toHaveProperty('expired');
  });
});

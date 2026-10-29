import { ValidationError } from '../../../../../shared/domain/errors';
import {
  Certification,
  NewCertificationProps,
} from '../../../domain/entities/certification.entity';
import { Education, NewEducationProps } from '../../../domain/entities/education.entity';
import { CertificationNotFoundError } from '../../../domain/errors/certification-not-found.error';
import { EducationNotFoundError } from '../../../domain/errors/education-not-found.error';
import {
  CertificationRepository,
  EducationRepository,
} from '../../../domain/repositories/education.repository';
import {
  CreateCertificationUseCase,
  CreateEducationUseCase,
  DeleteCertificationUseCase,
  DeleteEducationUseCase,
  GetCertificationAdminUseCase,
  GetEducationAdminUseCase,
  ListAllCertificationsUseCase,
  ListAllEducationUseCase,
  UpdateCertificationUseCase,
  UpdateEducationUseCase,
} from './education-admin.use-cases';

interface Identified {
  readonly id: string;
}

/** Repositorio en memoria genérico: ambos puertos comparten contrato. */
function memoryRepo<T extends Identified, N>(
  items: T[],
  build: (props: N, id: string) => T,
): {
  store: T[];
  findAllVisible: jest.Mock;
  findAll: jest.Mock;
  findById: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
} {
  const store = [...items];
  return {
    store,
    findAllVisible: jest.fn(),
    findAll: jest.fn().mockImplementation(() => Promise.resolve([...store])),
    findById: jest
      .fn()
      .mockImplementation((id: string) => Promise.resolve(store.find((x) => x.id === id) ?? null)),
    create: jest.fn().mockImplementation((props: N) => {
      const created = build(props, `new-${store.length + 1}`);
      store.push(created);
      return Promise.resolve(created);
    }),
    update: jest.fn().mockImplementation((item: T) => {
      const i = store.findIndex((x) => x.id === item.id);
      if (i < 0) return Promise.resolve(null);
      store[i] = item;
      return Promise.resolve(item);
    }),
    delete: jest.fn().mockImplementation((id: string) => {
      const i = store.findIndex((x) => x.id === id);
      if (i < 0) return Promise.resolve(false);
      store.splice(i, 1);
      return Promise.resolve(true);
    }),
  };
}

const educationRepo = (items: Education[]): EducationRepository & { store: Education[] } =>
  memoryRepo<Education, NewEducationProps>(items, (props, id) =>
    Education.create({ ...props, id }),
  );

const certificationRepo = (
  items: Certification[],
): CertificationRepository & { store: Certification[] } =>
  memoryRepo<Certification, NewCertificationProps>(items, (props, id) =>
    Certification.create({ ...props, id }),
  );

const NEW_EDU: NewEducationProps = {
  degree: { es: 'Ingeniería de Sistemas', en: "Bachelor's in Systems Engineering" },
  institution: 'UAGRM',
  startDate: '2012-03',
  endDate: '2020-06',
  inProgress: false,
  order: 1,
  visible: true,
};

const NEW_CERT: NewCertificationProps = {
  name: { es: 'Scrum Master', en: 'Scrum Master' },
  issuer: 'UAGRM School of Engineering',
  year: '2022',
  verificationUrl: null,
  credentialId: null,
  expiresAt: null,
  order: 1,
  visible: true,
};

const shownEdu = Education.create({ ...NEW_EDU, id: 'v' });
const hiddenEdu = Education.create({ ...NEW_EDU, id: 'h', visible: false });
const shownCert = Certification.create({ ...NEW_CERT, id: 'v' });
const hiddenCert = Certification.create({ ...NEW_CERT, id: 'h', visible: false });

describe('Education admin use cases (spec admin-content-management)', () => {
  it('lista todas, incluidas las ocultas, con datos bilingües crudos', async () => {
    const result = await new ListAllEducationUseCase(
      educationRepo([shownEdu, hiddenEdu]),
    ).execute();
    expect(result.value.map((e) => e.id)).toEqual(['v', 'h']);
    expect(result.value[1].visible).toBe(false);
    expect(result.value[0].degree).toEqual(NEW_EDU.degree);
    expect(result.value[0].order).toBe(1);
  });

  it('get: existente y 404', async () => {
    const repo = educationRepo([shownEdu]);
    expect((await new GetEducationAdminUseCase(repo).execute({ id: 'v' })).ok).toBe(true);
    const missing = await new GetEducationAdminUseCase(repo).execute({ id: 'zz' });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toBeInstanceOf(EducationNotFoundError);
  });

  it('create: válido → creado; en curso con endDate → ValidationError sin persistir', async () => {
    const repo = educationRepo([]);
    const created = await new CreateEducationUseCase(repo).execute(NEW_EDU);
    expect(created.ok).toBe(true);
    if (created.ok) expect(created.value.institution).toBe('UAGRM');

    const bad = await new CreateEducationUseCase(repo).execute({ ...NEW_EDU, inProgress: true });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toBeInstanceOf(ValidationError);
    expect(repo.store).toHaveLength(1);
  });

  it('update: parcial conserva el resto; valida el estado resultante; 404', async () => {
    const repo = educationRepo([shownEdu]);
    const useCase = new UpdateEducationUseCase(repo);

    const r = await useCase.execute({
      id: 'v',
      changes: { endDate: null, inProgress: true, visible: false },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.endDate).toBeNull();
      expect(r.value.inProgress).toBe(true);
      expect(r.value.visible).toBe(false);
      expect(r.value.institution).toBe('UAGRM');
      expect(r.value.startDate).toBe('2012-03');
    }

    // El estado resultante (en curso) no admite endDate aunque el cambio solo toque endDate.
    const invalid = await useCase.execute({ id: 'v', changes: { endDate: '2020-06' } });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error).toBeInstanceOf(ValidationError);
    expect(repo.store[0].endDate).toBeNull();

    const missing = await useCase.execute({ id: 'zz', changes: {} });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toBeInstanceOf(EducationNotFoundError);
  });

  it('delete: existente → ok; inexistente → 404', async () => {
    const repo = educationRepo([shownEdu]);
    expect((await new DeleteEducationUseCase(repo).execute({ id: 'v' })).ok).toBe(true);
    expect(repo.store).toHaveLength(0);
    const missing = await new DeleteEducationUseCase(repo).execute({ id: 'v' });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toBeInstanceOf(EducationNotFoundError);
  });
});

describe('Certification admin use cases (spec admin-content-management)', () => {
  it('lista todas, incluidas las ocultas, con datos bilingües crudos', async () => {
    const result = await new ListAllCertificationsUseCase(
      certificationRepo([shownCert, hiddenCert]),
    ).execute();
    expect(result.value.map((c) => c.id)).toEqual(['v', 'h']);
    expect(result.value[1].visible).toBe(false);
    expect(result.value[0].name).toEqual(NEW_CERT.name);
  });

  it('get: existente y 404', async () => {
    const repo = certificationRepo([shownCert]);
    expect((await new GetCertificationAdminUseCase(repo).execute({ id: 'v' })).ok).toBe(true);
    const missing = await new GetCertificationAdminUseCase(repo).execute({ id: 'zz' });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toBeInstanceOf(CertificationNotFoundError);
  });

  it('create: válido → creado; year inválido → ValidationError sin persistir', async () => {
    const repo = certificationRepo([]);
    const created = await new CreateCertificationUseCase(repo).execute({ ...NEW_CERT, year: null });
    expect(created.ok).toBe(true);
    if (created.ok) expect(created.value.year).toBeNull();

    const bad = await new CreateCertificationUseCase(repo).execute({ ...NEW_CERT, year: '22' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toBeInstanceOf(ValidationError);
    expect(repo.store).toHaveLength(1);
  });

  it('update: parcial conserva el resto; valida el estado resultante; 404', async () => {
    const repo = certificationRepo([shownCert]);
    const useCase = new UpdateCertificationUseCase(repo);

    const r = await useCase.execute({ id: 'v', changes: { year: '2023', order: 5 } });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.year).toBe('2023');
      expect(r.value.order).toBe(5);
      expect(r.value.issuer).toBe('UAGRM School of Engineering');
      expect(r.value.name).toEqual(NEW_CERT.name);
    }

    const invalid = await useCase.execute({ id: 'v', changes: { issuer: ' ' } });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error).toBeInstanceOf(ValidationError);
    expect(repo.store[0].issuer).toBe('UAGRM School of Engineering');

    const missing = await useCase.execute({ id: 'zz', changes: {} });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toBeInstanceOf(CertificationNotFoundError);
  });

  it('delete: existente → ok; inexistente → 404', async () => {
    const repo = certificationRepo([shownCert]);
    expect((await new DeleteCertificationUseCase(repo).execute({ id: 'v' })).ok).toBe(true);
    expect(repo.store).toHaveLength(0);
    const missing = await new DeleteCertificationUseCase(repo).execute({ id: 'v' });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toBeInstanceOf(CertificationNotFoundError);
  });

  describe('credencial de la certificación', () => {
    const CREDENTIAL = {
      verificationUrl: 'https://example.org/credenciales/1',
      credentialId: 'EJ-2023-0042',
      expiresAt: '2029-06',
    };

    it('el listado y el get devuelven los tres campos crudos', async () => {
      const withCredential = Certification.create({ ...NEW_CERT, ...CREDENTIAL, id: 'k' });
      const repo = certificationRepo([withCredential]);
      const list = await new ListAllCertificationsUseCase(repo).execute();
      expect(list.value[0]).toMatchObject(CREDENTIAL);
      const got = await new GetCertificationAdminUseCase(repo).execute({ id: 'k' });
      expect(got.ok && got.value).toMatchObject(CREDENTIAL);
    });

    it('create y update con valores válidos los guardan', async () => {
      const repo = certificationRepo([shownCert]);
      const created = await new CreateCertificationUseCase(repo).execute({
        ...NEW_CERT,
        ...CREDENTIAL,
      });
      expect(created.ok && created.value).toMatchObject(CREDENTIAL);
      const updated = await new UpdateCertificationUseCase(repo).execute({
        id: 'v',
        changes: { credentialId: 'OTRO-1' },
      });
      expect(updated.ok && updated.value.credentialId).toBe('OTRO-1');
    });

    it.each([
      ['verificationUrl', { verificationUrl: 'http://example.org/c/1' }],
      ['verificationUrl', { verificationUrl: 'javascript:alert(1)' }],
      ['credentialId', { credentialId: 'x'.repeat(101) }],
      ['expiresAt', { expiresAt: '2029-13' }],
      ['expiresAt', { expiresAt: '2021' }],
    ])('un valor inválido en %s devuelve ValidationError sin llamar a save', async (field, bad) => {
      const repo = certificationRepo([shownCert]);
      const created = await new CreateCertificationUseCase(repo).execute({ ...NEW_CERT, ...bad });
      expect(created.ok).toBe(false);
      if (!created.ok) expect(created.error.fields).toEqual([field]);
      expect(repo.create).not.toHaveBeenCalled();

      const updated = await new UpdateCertificationUseCase(repo).execute({
        id: 'v',
        changes: bad,
      });
      expect(updated.ok).toBe(false);
      if (!updated.ok) expect(updated.error).toBeInstanceOf(ValidationError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('update con null quita el valor sin tocar los demás', async () => {
      const repo = certificationRepo([
        Certification.create({ ...NEW_CERT, ...CREDENTIAL, id: 'k' }),
      ]);
      const result = await new UpdateCertificationUseCase(repo).execute({
        id: 'k',
        changes: { verificationUrl: null },
      });
      expect(result.ok && result.value).toMatchObject({
        verificationUrl: null,
        credentialId: 'EJ-2023-0042',
        expiresAt: '2029-06',
      });
    });
  });
});

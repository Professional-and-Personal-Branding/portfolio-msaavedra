import { ValidationError } from '../../../../../shared/domain/errors';
import { Experience, NewExperienceProps } from '../../../domain/entities/experience.entity';
import { ExperienceNotFoundError } from '../../../domain/errors/experience-not-found.error';
import { ExperienceRepository } from '../../../domain/repositories/experience.repository';
import {
  CreateExperienceUseCase,
  DeleteExperienceUseCase,
  GetExperienceAdminUseCase,
  ListAllExperiencesUseCase,
  UpdateExperienceUseCase,
} from './experience-admin.use-cases';

const NEW: NewExperienceProps = {
  company: 'ACME',
  role: { es: 'Dev', en: 'Dev' },
  startDate: '2025-01',
  endDate: null,
  current: true,
  location: 'Remoto',
  summary: { es: 'Resumen' },
  highlights: { es: ['a'] },
  technologies: ['Java'],
  tags: ['java'],
  sector: [],
  order: 0,
  visible: true,
};

function repoWith(items: Experience[]): ExperienceRepository & { store: Experience[] } {
  const store = [...items];
  return {
    store,
    findAllVisible: jest.fn(),
    findVisibleById: jest.fn(),
    findAll: jest.fn().mockImplementation(() => Promise.resolve([...store])),
    findById: jest
      .fn()
      .mockImplementation((id: string) => Promise.resolve(store.find((e) => e.id === id) ?? null)),
    create: jest.fn().mockImplementation((props: NewExperienceProps) => {
      const created = Experience.create({ ...props, id: `new-${store.length + 1}` });
      store.push(created);
      return Promise.resolve(created);
    }),
    update: jest.fn().mockImplementation((e: Experience) => {
      const i = store.findIndex((x) => x.id === e.id);
      if (i < 0) return Promise.resolve(null);
      store[i] = e;
      return Promise.resolve(e);
    }),
    delete: jest.fn().mockImplementation((id: string) => {
      const i = store.findIndex((x) => x.id === id);
      if (i < 0) return Promise.resolve(false);
      store.splice(i, 1);
      return Promise.resolve(true);
    }),
  };
}

const hidden = Experience.create({ ...NEW, id: 'h', visible: false, startDate: '2020-01' });
const visible = Experience.create({ ...NEW, id: 'v', startDate: '2023-01' });

describe('Experience admin use cases (spec admin-experience-crud)', () => {
  it('lista todas incluidas ocultas, con datos crudos y orden canónico', async () => {
    const result = await new ListAllExperiencesUseCase(repoWith([hidden, visible])).execute();
    expect(result.value.map((e) => e.id)).toEqual(['v', 'h']);
    expect(result.value[1].visible).toBe(false);
    expect(result.value[0].role).toEqual({ es: 'Dev', en: 'Dev' });
  });

  it('get: existente y 404', async () => {
    const repo = repoWith([visible]);
    expect((await new GetExperienceAdminUseCase(repo).execute({ id: 'v' })).ok).toBe(true);
    const missing = await new GetExperienceAdminUseCase(repo).execute({ id: 'zz' });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toBeInstanceOf(ExperienceNotFoundError);
  });

  it('create: válido → creada con id; inválido → ValidationError sin persistir', async () => {
    const repo = repoWith([]);
    const ok = await new CreateExperienceUseCase(repo).execute(NEW);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.id).toBe('new-1');

    const bad = await new CreateExperienceUseCase(repo).execute({ ...NEW, startDate: '2025-13' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toBeInstanceOf(ValidationError);
    expect(repo.store).toHaveLength(1);
  });

  it('update: parcial conserva el resto; 404; validación sobre el estado resultante', async () => {
    const repo = repoWith([visible]);
    const useCase = new UpdateExperienceUseCase(repo);

    const r = await useCase.execute({ id: 'v', changes: { tags: ['dotnet'], visible: false } });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.tags).toEqual(['dotnet']);
      expect(r.value.visible).toBe(false);
      expect(r.value.company).toBe('ACME');
    }

    const missing = await useCase.execute({ id: 'zz', changes: {} });
    expect(missing.ok).toBe(false);

    const invalid = await useCase.execute({ id: 'v', changes: { endDate: '2010-01' } });
    expect(invalid.ok).toBe(false); // current=true con endDate
    if (!invalid.ok) expect(invalid.error).toBeInstanceOf(ValidationError);
  });

  it('delete: existente → ok; inexistente → 404', async () => {
    const repo = repoWith([visible]);
    expect((await new DeleteExperienceUseCase(repo).execute({ id: 'v' })).ok).toBe(true);
    expect(repo.store).toHaveLength(0);
    expect((await new DeleteExperienceUseCase(repo).execute({ id: 'v' })).ok).toBe(false);
  });
});

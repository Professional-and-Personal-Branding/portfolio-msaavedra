import { ValidationError } from '../../../../../shared/domain/errors';
import { NewProjectProps, Project } from '../../../domain/entities/project.entity';
import { ProjectNotFoundError } from '../../../domain/errors/project-not-found.error';
import { ProjectRepository } from '../../../domain/repositories/project.repository';
import {
  CreateProjectUseCase,
  DeleteProjectUseCase,
  GetProjectAdminUseCase,
  ListAllProjectsUseCase,
  UpdateProjectUseCase,
} from './project-admin.use-cases';

const NEW: NewProjectProps = {
  name: 'Portafolio',
  role: { es: 'Autor', en: 'Author' },
  period: '2026',
  summary: { es: 'Resumen' },
  technologies: ['NestJS'],
  tags: ['nestjs'],
  url: null,
  order: 1,
  visible: true,
};

function repoWith(items: Project[]): ProjectRepository & { store: Project[] } {
  const store = [...items];
  return {
    store,
    findAllVisible: jest.fn(),
    findAll: jest.fn().mockImplementation(() => Promise.resolve([...store])),
    findById: jest
      .fn()
      .mockImplementation((id: string) => Promise.resolve(store.find((p) => p.id === id) ?? null)),
    create: jest.fn().mockImplementation((props: NewProjectProps) => {
      const created = Project.create({ ...props, id: `new-${store.length + 1}` });
      store.push(created);
      return Promise.resolve(created);
    }),
    update: jest.fn().mockImplementation((p: Project) => {
      const i = store.findIndex((x) => x.id === p.id);
      if (i < 0) return Promise.resolve(null);
      store[i] = p;
      return Promise.resolve(p);
    }),
    delete: jest.fn().mockImplementation((id: string) => {
      const i = store.findIndex((x) => x.id === id);
      if (i < 0) return Promise.resolve(false);
      store.splice(i, 1);
      return Promise.resolve(true);
    }),
  };
}

const hidden = Project.create({ ...NEW, id: 'h', visible: false });
const shown = Project.create({ ...NEW, id: 'v' });

describe('Project admin use cases (spec admin-content-management)', () => {
  it('lista todos, incluidos los ocultos, con datos bilingües crudos', async () => {
    const result = await new ListAllProjectsUseCase(repoWith([shown, hidden])).execute();
    expect(result.value.map((p) => p.id)).toEqual(['v', 'h']);
    expect(result.value[1].visible).toBe(false);
    expect(result.value[0].role).toEqual({ es: 'Autor', en: 'Author' });
  });

  it('get: existente y 404', async () => {
    const repo = repoWith([shown]);
    expect((await new GetProjectAdminUseCase(repo).execute({ id: 'v' })).ok).toBe(true);
    const missing = await new GetProjectAdminUseCase(repo).execute({ id: 'zz' });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toBeInstanceOf(ProjectNotFoundError);
  });

  it('create: válido → creado; url relativa → ValidationError sin persistir', async () => {
    const repo = repoWith([]);
    const created = await new CreateProjectUseCase(repo).execute({
      ...NEW,
      url: 'https://github.com/manu/portafolio',
    });
    expect(created.ok).toBe(true);
    if (created.ok) expect(created.value.url).toBe('https://github.com/manu/portafolio');

    const bad = await new CreateProjectUseCase(repo).execute({ ...NEW, url: '/relativa' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toBeInstanceOf(ValidationError);
    expect(repo.store).toHaveLength(1);
  });

  it('update: parcial conserva el resto; valida el estado resultante; 404', async () => {
    const repo = repoWith([shown]);
    const useCase = new UpdateProjectUseCase(repo);

    const r = await useCase.execute({ id: 'v', changes: { url: 'https://a.dev', visible: false } });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.url).toBe('https://a.dev');
      expect(r.value.visible).toBe(false);
      expect(r.value.name).toBe('Portafolio');
    }

    const invalid = await useCase.execute({ id: 'v', changes: { name: ' ' } });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error).toBeInstanceOf(ValidationError);
    expect((await useCase.execute({ id: 'zz', changes: {} })).ok).toBe(false);
  });

  it('delete: existente → ok; inexistente → 404', async () => {
    const repo = repoWith([shown]);
    expect((await new DeleteProjectUseCase(repo).execute({ id: 'v' })).ok).toBe(true);
    expect(repo.store).toHaveLength(0);
    expect((await new DeleteProjectUseCase(repo).execute({ id: 'v' })).ok).toBe(false);
  });
});

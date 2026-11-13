import { ConflictError, ValidationError } from '../../../../../shared/domain/errors';
import {
  FeaturedRepository,
  NewFeaturedRepositoryProps,
} from '../../../domain/entities/featured-repository.entity';
import { FeaturedRepositoryNotFoundError } from '../../../domain/errors/featured-repository-not-found.error';
import { FeaturedRepositoryRepository } from '../../../domain/repositories/featured-repository.repository';
import {
  CreateFeaturedRepositoryUseCase,
  DeleteFeaturedRepositoryUseCase,
  GetFeaturedRepositoryAdminUseCase,
  ListAllFeaturedRepositoriesUseCase,
  UpdateFeaturedRepositoryUseCase,
} from './featured-repository-admin.use-cases';

const NEW: NewFeaturedRepositoryProps = {
  name: 'reservas-api',
  url: 'https://github.com/octo-org/reservas-api',
  language: 'Java',
  description: { es: 'API de reservas', en: 'Booking API' },
  technologies: ['Spring Boot'],
  tags: ['java'],
  order: 1,
  visible: true,
};

function repoWith(
  items: FeaturedRepository[],
): FeaturedRepositoryRepository & { store: FeaturedRepository[] } {
  const store = [...items];
  return {
    store,
    findAllVisible: jest.fn(),
    findAll: jest.fn().mockImplementation(() => Promise.resolve([...store])),
    findById: jest
      .fn()
      .mockImplementation((id: string) => Promise.resolve(store.find((r) => r.id === id) ?? null)),
    create: jest.fn().mockImplementation((props: NewFeaturedRepositoryProps) => {
      const created = FeaturedRepository.create({ ...props, id: `new-${store.length + 1}` });
      store.push(created);
      return Promise.resolve(created);
    }),
    update: jest.fn().mockImplementation((r: FeaturedRepository) => {
      const i = store.findIndex((x) => x.id === r.id);
      if (i < 0) return Promise.resolve(null);
      store[i] = r;
      return Promise.resolve(r);
    }),
    delete: jest.fn().mockImplementation((id: string) => {
      const i = store.findIndex((x) => x.id === id);
      if (i < 0) return Promise.resolve(false);
      store.splice(i, 1);
      return Promise.resolve(true);
    }),
  };
}

const existing = (id = 'r1', overrides: Partial<NewFeaturedRepositoryProps> = {}) =>
  FeaturedRepository.create({ ...NEW, ...overrides, id });

describe('casos de uso de administración de repositorios destacados', () => {
  it('lista todos, ocultos incluidos y con la descripción cruda', async () => {
    const repo = repoWith([existing('a'), existing('b', { visible: false })]);
    const r = await new ListAllFeaturedRepositoriesUseCase(repo).execute();
    expect(r.value.map((x) => [x.id, x.visible])).toEqual([
      ['a', true],
      ['b', false],
    ]);
    expect(r.value[0].description).toEqual({ es: 'API de reservas', en: 'Booking API' });
  });

  describe('crear', () => {
    it('guarda un repositorio válido', async () => {
      const repo = repoWith([]);
      const r = await new CreateFeaturedRepositoryUseCase(repo).execute(NEW);
      expect(r.ok).toBe(true);
      expect(repo.create).toHaveBeenCalledTimes(1);
      expect(repo.store).toHaveLength(1);
    });

    it('un duplicado con otras mayúsculas es ConflictError y no guarda', async () => {
      const repo = repoWith([existing()]);
      const r = await new CreateFeaturedRepositoryUseCase(repo).execute({
        ...NEW,
        url: 'https://github.com/Octo-Org/RESERVAS-api',
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error).toBeInstanceOf(ConflictError);
        expect(r.error.message).toContain('Ese repositorio ya está cargado');
      }
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('un dato inválido es ValidationError y no guarda', async () => {
      const repo = repoWith([]);
      const r = await new CreateFeaturedRepositoryUseCase(repo).execute({
        ...NEW,
        url: 'https://gitlab.com/a/b',
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBeInstanceOf(ValidationError);
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.findAll).not.toHaveBeenCalled();
    });
  });

  describe('editar', () => {
    it('un PATCH solo de name responde ok y no choca con su propia URL', async () => {
      const repo = repoWith([existing()]);
      const r = await new UpdateFeaturedRepositoryUseCase(repo).execute({
        id: 'r1',
        changes: { name: 'otro nombre' },
      });
      expect(r.ok).toBe(true);
      expect(repo.update).toHaveBeenCalledTimes(1);
      expect(repo.findAll).not.toHaveBeenCalled();
    });

    it('cambiar la URL a la de otro registro es ConflictError sin guardar', async () => {
      const repo = repoWith([
        existing('r1'),
        existing('r2', { url: 'https://github.com/octo-org/otro' }),
      ]);
      const r = await new UpdateFeaturedRepositoryUseCase(repo).execute({
        id: 'r2',
        changes: { url: 'https://github.com/OCTO-ORG/reservas-api' },
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBeInstanceOf(ConflictError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('cambiar la URL a una libre guarda', async () => {
      const repo = repoWith([existing('r1')]);
      const r = await new UpdateFeaturedRepositoryUseCase(repo).execute({
        id: 'r1',
        changes: { url: 'https://github.com/octo-org/nuevo' },
      });
      expect(r.ok).toBe(true);
      expect(repo.update).toHaveBeenCalledTimes(1);
    });

    it('un cambio inválido es ValidationError sin guardar', async () => {
      const repo = repoWith([existing()]);
      const r = await new UpdateFeaturedRepositoryUseCase(repo).execute({
        id: 'r1',
        changes: { name: '   ' },
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBeInstanceOf(ValidationError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('un id inexistente es not found', async () => {
      const repo = repoWith([]);
      const r = await new UpdateFeaturedRepositoryUseCase(repo).execute({
        id: 'x',
        changes: { name: 'a' },
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBeInstanceOf(FeaturedRepositoryNotFoundError);
    });
  });

  it('detalle: existente ok, inexistente not found', async () => {
    const repo = repoWith([existing()]);
    const uc = new GetFeaturedRepositoryAdminUseCase(repo);
    expect((await uc.execute({ id: 'r1' })).ok).toBe(true);
    const missing = await uc.execute({ id: 'x' });
    expect(missing.ok).toBe(false);
  });

  it('borrar: existente ok, inexistente not found', async () => {
    const repo = repoWith([existing()]);
    const uc = new DeleteFeaturedRepositoryUseCase(repo);
    expect((await uc.execute({ id: 'r1' })).ok).toBe(true);
    expect(repo.store).toHaveLength(0);
    const again = await uc.execute({ id: 'r1' });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toBeInstanceOf(FeaturedRepositoryNotFoundError);
  });
});

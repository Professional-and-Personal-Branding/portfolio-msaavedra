import {
  NewSkillCategoryProps,
  SkillCategory,
} from '../../../domain/entities/skill-category.entity';
import { NewSkillProps, Skill } from '../../../domain/entities/skill.entity';
import {
  SkillCategoryNotFoundError,
  SkillNotFoundError,
} from '../../../domain/errors/skill.errors';
import { SkillCategoryRepository } from '../../../domain/repositories/skill-category.repository';
import {
  CreateSkillCategoryUseCase,
  CreateSkillUseCase,
  DeleteSkillCategoryUseCase,
  DeleteSkillUseCase,
  ListSkillCategoriesAdminUseCase,
  UpdateSkillCategoryUseCase,
  UpdateSkillUseCase,
} from './skill-admin.use-cases';

function buildRepo() {
  const categories: SkillCategory[] = [
    SkillCategory.create({
      id: 'c1',
      name: { es: 'Lenguajes', en: 'Languages' },
      order: 0,
      skills: [
        Skill.create({ id: 's1', name: 'Java', tags: ['java'], order: 0, categoryId: 'c1' }),
      ],
    }),
    SkillCategory.create({ id: 'c2', name: { es: 'Otra' }, order: 1, skills: [] }),
  ];
  const repo: SkillCategoryRepository = {
    findAll: jest.fn().mockImplementation(() => Promise.resolve([...categories])),
    findById: jest
      .fn()
      .mockImplementation((id: string) =>
        Promise.resolve(categories.find((c) => c.id === id) ?? null),
      ),
    create: jest.fn().mockImplementation((props: NewSkillCategoryProps) => {
      const c = SkillCategory.create({ id: 'c-new', skills: [], ...props });
      categories.push(c);
      return Promise.resolve(c);
    }),
    update: jest.fn().mockImplementation((c: SkillCategory) => Promise.resolve(c)),
    delete: jest.fn().mockImplementation((id: string) => {
      const i = categories.findIndex((c) => c.id === id);
      if (i < 0) return Promise.resolve(false);
      categories.splice(i, 1);
      return Promise.resolve(true);
    }),
    findSkillById: jest
      .fn()
      .mockImplementation((id: string) =>
        Promise.resolve(categories.flatMap((c) => [...c.skills]).find((s) => s.id === id) ?? null),
      ),
    createSkill: jest
      .fn()
      .mockImplementation((categoryId: string, props: NewSkillProps) =>
        Promise.resolve(Skill.create({ id: 's-new', categoryId, ...props })),
      ),
    updateSkill: jest.fn().mockImplementation((s: Skill) => Promise.resolve(s)),
    deleteSkill: jest.fn().mockImplementation((id: string) => Promise.resolve(id === 's1')),
  };
  return repo;
}

describe('Skill admin use cases (spec admin-skill-crud)', () => {
  it('lista categorías con nombre crudo y skills con categoryId', async () => {
    const r = await new ListSkillCategoriesAdminUseCase(buildRepo()).execute();
    expect(r.value[0].name).toEqual({ es: 'Lenguajes', en: 'Languages' });
    expect(r.value[0].skills[0]).toEqual({
      id: 's1',
      name: 'Java',
      tags: ['java'],
      order: 0,
      categoryId: 'c1',
    });
  });

  it('crea, edita y borra categorías; 404 en inexistentes', async () => {
    const repo = buildRepo();
    const created = await new CreateSkillCategoryUseCase(repo).execute({
      name: { es: 'Datos', en: 'Data' },
      order: 20,
    });
    expect(created.value.skills).toEqual([]);

    const updated = await new UpdateSkillCategoryUseCase(repo).execute({
      id: 'c1',
      changes: { order: 5 },
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.value.order).toBe(5);
      expect(updated.value.name).toEqual({ es: 'Lenguajes', en: 'Languages' });
    }

    const missing = await new UpdateSkillCategoryUseCase(repo).execute({ id: 'zz', changes: {} });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toBeInstanceOf(SkillCategoryNotFoundError);

    expect((await new DeleteSkillCategoryUseCase(repo).execute({ id: 'c2' })).ok).toBe(true);
    expect((await new DeleteSkillCategoryUseCase(repo).execute({ id: 'c2' })).ok).toBe(false);
  });

  it('crea skill en categoría existente; 404 si la categoría no existe', async () => {
    const repo = buildRepo();
    const ok = await new CreateSkillUseCase(repo).execute({
      categoryId: 'c1',
      props: { name: 'Kafka', tags: ['java', 'messaging'], order: 3 },
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value).toMatchObject({ name: 'Kafka', categoryId: 'c1' });

    const bad = await new CreateSkillUseCase(repo).execute({
      categoryId: 'nope',
      props: { name: 'X', tags: [], order: 0 },
    });
    expect(bad.ok).toBe(false);
  });

  it('edita skill (tags, mover de categoría); 404 skill y 404 categoría destino', async () => {
    const repo = buildRepo();
    const useCase = new UpdateSkillUseCase(repo);

    const tags = await useCase.execute({ id: 's1', changes: { tags: ['ruby'] } });
    expect(tags.ok).toBe(true);
    if (tags.ok) expect(tags.value.tags).toEqual(['ruby']);

    const moved = await useCase.execute({ id: 's1', changes: { categoryId: 'c2' } });
    expect(moved.ok).toBe(true);
    if (moved.ok) expect(moved.value.categoryId).toBe('c2');

    const noSkill = await useCase.execute({ id: 'zz', changes: {} });
    expect(noSkill.ok).toBe(false);
    if (!noSkill.ok) expect(noSkill.error).toBeInstanceOf(SkillNotFoundError);

    const noCat = await useCase.execute({ id: 's1', changes: { categoryId: 'nope' } });
    expect(noCat.ok).toBe(false);
    if (!noCat.ok) expect(noCat.error).toBeInstanceOf(SkillCategoryNotFoundError);
  });

  it('borra skill; 404 si no existe', async () => {
    const repo = buildRepo();
    expect((await new DeleteSkillUseCase(repo).execute({ id: 's1' })).ok).toBe(true);
    expect((await new DeleteSkillUseCase(repo).execute({ id: 'zz' })).ok).toBe(false);
  });
});

import { Experience } from '../../domain/entities/experience.entity';
import { ExperienceNotFoundError } from '../../domain/errors/experience-not-found.error';
import { ExperienceRepository } from '../../domain/repositories/experience.repository';
import { GetExperienceByIdUseCase } from './get-experience-by-id.use-case';
import { ListExperiencesUseCase } from './list-experiences.use-case';

const writeStubs = () => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

function exp(id: string, order: number, startDate: string, visible = true): Experience {
  return Experience.create({
    id,
    company: `Empresa ${id}`,
    role: { es: `Rol ${id}`, en: `Role ${id}` },
    startDate,
    endDate: null,
    current: false,
    location: 'Remoto',
    summary: { es: 'Resumen' }, // sin inglés → fallback
    highlights: { es: ['logro'], en: ['achievement'] },
    technologies: ['Java'],
    tags: ['java'],
    sector: ['fintech'],
    order,
    visible,
  });
}

function repoWith(items: Experience[]): ExperienceRepository {
  return {
    ...writeStubs(),
    findAllVisible: jest.fn().mockResolvedValue(items.filter((e) => e.visible)),
    findVisibleById: jest
      .fn()
      .mockImplementation((id: string) =>
        Promise.resolve(items.find((e) => e.id === id && e.visible) ?? null),
      ),
  };
}

describe('ListExperiencesUseCase', () => {
  it('devuelve la lista ordenada y resuelta en inglés', async () => {
    const useCase = new ListExperiencesUseCase(
      repoWith([exp('b', 1, '2019-01'), exp('a', 0, '2021-01')]),
    );
    const result = await useCase.execute({ locale: 'en' });

    expect(result.ok).toBe(true);
    expect(result.value.map((e) => e.id)).toEqual(['a', 'b']);
    expect(result.value[0].role).toBe('Role a');
    expect(result.value[0].highlights).toEqual(['achievement']);
    expect(result.value[0].summary).toBe('Resumen'); // fallback por campo
  });

  it('highlights es siempre string[] y no expone visible/createdAt', async () => {
    const useCase = new ListExperiencesUseCase(repoWith([exp('a', 0, '2021-01')]));
    const result = await useCase.execute({ locale: 'es' });
    const item = result.value[0] as unknown as Record<string, unknown>;
    expect(Array.isArray(item['highlights'])).toBe(true);
    expect(item).not.toHaveProperty('visible');
    expect(item).not.toHaveProperty('createdAt');
  });

  it('excluye experiencias ocultas aunque el repo las devolviera', async () => {
    const repo: ExperienceRepository = {
      ...writeStubs(),
      findAllVisible: jest
        .fn()
        .mockResolvedValue([exp('a', 0, '2021-01'), exp('h', 1, '2020-01', false)]),
      findVisibleById: jest.fn(),
    };
    const result = await new ListExperiencesUseCase(repo).execute({ locale: 'es' });
    expect(result.value.map((e) => e.id)).toEqual(['a']);
  });
});

describe('GetExperienceByIdUseCase', () => {
  it('devuelve la experiencia pedida resuelta al locale', async () => {
    const useCase = new GetExperienceByIdUseCase(repoWith([exp('a', 0, '2021-01')]));
    const result = await useCase.execute({ id: 'a', locale: 'en' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.company).toBe('Empresa a');
    expect(result.value.role).toBe('Role a');
  });

  it('id inexistente → ExperienceNotFoundError', async () => {
    const useCase = new GetExperienceByIdUseCase(repoWith([exp('a', 0, '2021-01')]));
    const result = await useCase.execute({ id: 'zzz', locale: 'es' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(ExperienceNotFoundError);
    expect(result.error.code).toBe('EXPERIENCIA_NOT_FOUND');
    expect(result.error.message).toContain('zzz');
  });

  it('experiencia oculta → ExperienceNotFoundError', async () => {
    const useCase = new GetExperienceByIdUseCase(repoWith([exp('h', 0, '2021-01', false)]));
    const result = await useCase.execute({ id: 'h', locale: 'es' });
    expect(result.ok).toBe(false);
  });
});

import { FeaturedRepository } from '../../domain/entities/featured-repository.entity';
import { FeaturedRepositoryRepository } from '../../domain/repositories/featured-repository.repository';
import { ListFeaturedRepositoriesUseCase } from './list-featured-repositories.use-case';

const repository = (id: string, visible = true, language: string | null = 'Java') =>
  FeaturedRepository.create({
    id,
    name: `repo-${id}`,
    url: `https://github.com/octo-org/repo-${id}`,
    language,
    description: { es: 'Descripción', en: 'Description' },
    technologies: ['Spring Boot'],
    tags: ['java'],
    order: 0,
    visible,
  });

describe('ListFeaturedRepositoriesUseCase', () => {
  it('resuelve el locale, excluye ocultos y no expone visible ni stars', async () => {
    const repo = {
      findAllVisible: jest.fn().mockResolvedValue([repository('a'), repository('h', false)]),
    } as unknown as FeaturedRepositoryRepository;
    const r = await new ListFeaturedRepositoriesUseCase(repo).execute({ locale: 'en' });
    expect(r.value).toEqual([
      {
        id: 'a',
        name: 'repo-a',
        url: 'https://github.com/octo-org/repo-a',
        language: 'Java',
        description: 'Description',
        technologies: ['Spring Boot'],
        tags: ['java'],
        order: 0,
      },
    ]);
  });

  it('language nulo se conserva como null', async () => {
    const repo = {
      findAllVisible: jest.fn().mockResolvedValue([repository('a', true, null)]),
    } as unknown as FeaturedRepositoryRepository;
    const r = await new ListFeaturedRepositoriesUseCase(repo).execute({ locale: 'es' });
    expect(r.value[0].language).toBeNull();
  });
});

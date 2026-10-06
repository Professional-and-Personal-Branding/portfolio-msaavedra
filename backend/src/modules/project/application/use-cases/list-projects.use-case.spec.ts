import { Project } from '../../domain/entities/project.entity';
import { ProjectRepository } from '../../domain/repositories/project.repository';
import { ListProjectsUseCase } from './list-projects.use-case';

const project = (id: string, visible = true) =>
  Project.create({
    id,
    name: `Proyecto ${id}`,
    role: { es: 'Autor', en: 'Author' },
    period: '2026',
    summary: { es: 'Resumen' },
    technologies: ['NestJS'],
    tags: ['nestjs'],
    url: null,
    order: 0,
    visible,
  });

describe('ListProjectsUseCase', () => {
  it('resuelve locale con fallback, excluye ocultos y no expone visible', async () => {
    const repo = {
      findAllVisible: jest.fn().mockResolvedValue([project('a'), project('h', false)]),
    } as unknown as ProjectRepository;
    const r = await new ListProjectsUseCase(repo).execute({ locale: 'en' });
    expect(r.value).toHaveLength(1);
    expect(r.value[0]).toEqual({
      id: 'a',
      name: 'Proyecto a',
      role: 'Author',
      period: '2026',
      summary: 'Resumen',
      technologies: ['NestJS'],
      tags: ['nestjs'],
      url: null,
      order: 0,
    });
  });
});

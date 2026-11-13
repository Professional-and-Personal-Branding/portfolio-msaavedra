import { CuratedProfileOutput } from '../dto/curated-profile.output';
import { sectionsWithData } from './sections-with-data';

type Repo = CuratedProfileOutput['repositories'][number];

const repo = (id: string): Repo => ({
  id,
  name: id,
  url: `https://github.com/octo-org/${id}`,
  language: null,
  description: 'd',
  technologies: [],
  tags: [],
  order: 0,
});

function output(repositories: Repo[]): CuratedProfileOutput {
  return {
    profile: null,
    experiences: [],
    skillCategories: [],
    projects: [],
    repositories,
    education: [],
    certifications: [],
    socialLinks: [],
  } as unknown as CuratedProfileOutput;
}

describe('sectionsWithData', () => {
  it.each([
    [0, false],
    [1, false],
    [2, true],
    [3, true],
  ])('con %i repositorios, repositories con datos: %s', (count, expected) => {
    const repositories = Array.from({ length: count }, (_, i) => repo(`r${i}`));
    expect(sectionsWithData(output(repositories)).has('repositories')).toBe(expected);
  });

  it('no mezcla repositorios con proyectos', () => {
    const withProjects = {
      ...output([]),
      projects: [{ id: 'p' }],
    } as unknown as CuratedProfileOutput;
    const has = sectionsWithData(withProjects);
    expect(has.has('projects')).toBe(true);
    expect(has.has('repositories')).toBe(false);
  });
});

import { CuratedProfile } from '../../domain/entities/curated-profile.entity';
import { CuratedProfileRepository } from '../../domain/repositories/curated-profile.repository';
import { CuratedProfileOutput } from '../dto/curated-profile.output';
import { CuratedProfileComposer } from '../services/curated-profile.composer';
import { GetProfileHeadUseCase } from './get-profile-head.use-case';

const BASE = 'https://manuel.dev';

function curated(
  visibility: 'PUBLIC' | 'PROTECTED' | 'PRIVATE',
  archivedAt: Date | null = null,
): CuratedProfile {
  return { slug: 'tech-lead-dotnet', visibility, archivedAt } as unknown as CuratedProfile;
}

const RESOLVED = {
  slug: 'tech-lead-dotnet',
  title: 'Tech Lead .NET',
  headline: 'Titular secreto',
  description: 'Descripción del perfil',
  visibility: 'PUBLIC',
  profile: { fullName: 'Ada', headline: 'h', summary: 's', email: 'a@x.com', location: 'SCZ' },
  socialLinks: [],
} as unknown as CuratedProfileOutput;

function build(found: CuratedProfile | null) {
  const repo = {
    findBySlugOrAlias: jest.fn().mockResolvedValue(found),
  } as unknown as CuratedProfileRepository;
  const compose = jest.fn().mockResolvedValue(RESOLVED);
  const composer = { compose } as unknown as CuratedProfileComposer;
  return { useCase: new GetProfileHeadUseCase(repo, composer), compose, repo };
}

const run = async (found: CuratedProfile | null, slug = 'tech-lead-dotnet') =>
  (await build(found).useCase.execute({ slug, locale: 'es', baseUrl: BASE })).value;

describe('GetProfileHeadUseCase', () => {
  it('PUBLIC: textos del perfil e index, follow', async () => {
    const { useCase, compose } = build(curated('PUBLIC'));
    const html = (await useCase.execute({ slug: 'tech-lead-dotnet', locale: 'es', baseUrl: BASE }))
      .value;
    expect(compose).toHaveBeenCalledWith(expect.anything(), 'es');
    expect(html).toContain('<title>Tech Lead .NET · Ada</title>');
    expect(html).toContain('content="index, follow"');
  });

  it('PROTECTED: genérico, noindex y sin ningún texto del perfil', async () => {
    const { useCase, compose } = build(curated('PROTECTED'));
    const html = (await useCase.execute({ slug: 'tech-lead-dotnet', locale: 'es', baseUrl: BASE }))
      .value;
    expect(compose).not.toHaveBeenCalled();
    expect(html).toContain('content="noindex, nofollow"');
    expect(html).not.toContain('Tech Lead .NET');
    expect(html).not.toContain('Titular secreto');
  });

  it('PUBLIC archivado: el mismo genérico que un slug inexistente', async () => {
    expect(await run(curated('PUBLIC', new Date('2026-10-01')))).toBe(await run(null));
  });

  it('PRIVATE e inexistente dan exactamente el mismo cuerpo', async () => {
    expect(await run(curated('PRIVATE'))).toBe(await run(null));
  });

  it('sin slug: genérico, sin consultar la base', async () => {
    const { useCase, repo } = build(curated('PUBLIC'));
    const html = (await useCase.execute({ slug: '', locale: 'es', baseUrl: BASE })).value;
    expect(repo.findBySlugOrAlias).not.toHaveBeenCalled();
    expect(html).toContain('content="noindex, nofollow"');
  });
});

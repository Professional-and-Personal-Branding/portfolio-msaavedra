import { CuratedProfile } from '../../domain/entities/curated-profile.entity';
import { CuratedProfileRepository } from '../../domain/repositories/curated-profile.repository';
import { CuratedProfileOutput } from '../dto/curated-profile.output';
import { CuratedProfileComposer } from '../services/curated-profile.composer';
import { ProfileHeadCache } from '../services/profile-head.cache';
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
  sections: [],
  skillCategories: [],
  education: [],
  certifications: [],
  socialLinks: [],
} as unknown as CuratedProfileOutput;

function build(found: CuratedProfile | null, cache = new ProfileHeadCache()) {
  const repo = {
    findBySlugOrAlias: jest.fn().mockResolvedValue(found),
  } as unknown as CuratedProfileRepository;
  const compose = jest.fn().mockResolvedValue(RESOLVED);
  const composer = { compose } as unknown as CuratedProfileComposer;
  return { useCase: new GetProfileHeadUseCase(repo, composer, cache), compose, repo };
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

  it('PUBLIC: repetir la petición no vuelve a componer el perfil (ruta sin límite)', async () => {
    const { useCase, compose } = build(curated('PUBLIC'));
    const input = { slug: 'tech-lead-dotnet', locale: 'es' as const, baseUrl: BASE };
    const first = (await useCase.execute(input)).value;
    for (let i = 0; i < 5; i += 1) expect((await useCase.execute(input)).value).toBe(first);
    expect(compose).toHaveBeenCalledTimes(1);
    // Otro idioma es otro fragmento.
    await useCase.execute({ ...input, locale: 'en' });
    expect(compose).toHaveBeenCalledTimes(2);
  });

  it('vencido el TTL, vuelve a componer', async () => {
    let now = 0;
    const { useCase, compose } = build(curated('PUBLIC'), new ProfileHeadCache(() => now, 1_000));
    const input = { slug: 'tech-lead-dotnet', locale: 'es' as const, baseUrl: BASE };
    await useCase.execute(input);
    now = 1_000;
    await useCase.execute(input);
    expect(compose).toHaveBeenCalledTimes(2);
  });

  it('lo que no resuelve no entra en la caché', async () => {
    const cache = new ProfileHeadCache();
    await build(null, cache).useCase.execute({ slug: 'no-existe', locale: 'es', baseUrl: BASE });
    await build(curated('PRIVATE'), cache).useCase.execute({
      slug: 'tech-lead-dotnet',
      locale: 'es',
      baseUrl: BASE,
    });
    expect(cache.size).toBe(0);
  });

  // add-curated-profile-lifecycle + caché: la tabla de verdad va antes que la caché.
  it('archivar un perfil ya cacheado corta sus textos al instante, sin esperar el TTL', async () => {
    const cache = new ProfileHeadCache();
    const input = { slug: 'tech-lead-dotnet', locale: 'es' as const, baseUrl: BASE };
    const publico = (await build(curated('PUBLIC'), cache).useCase.execute(input)).value;
    expect(publico).toContain('Tech Lead .NET');

    const archivado = (
      await build(curated('PUBLIC', new Date('2026-10-08')), cache).useCase.execute(input)
    ).value;
    expect(archivado).toContain('content="noindex, nofollow"');
    expect(archivado).not.toContain('Tech Lead .NET');
  });
});

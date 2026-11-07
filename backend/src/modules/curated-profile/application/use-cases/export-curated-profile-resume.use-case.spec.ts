import { fail, ok } from '../../../../shared/domain/result';
import { CuratedProfile } from '../../domain/entities/curated-profile.entity';
import { CuratedProfileAccessDeniedError } from '../../domain/errors/curated-profile-access-denied.error';
import { CuratedProfileNotFoundError } from '../../domain/errors/curated-profile-not-found.error';
import { CuratedProfileRepository } from '../../domain/repositories/curated-profile.repository';
import { CuratedProfileOutput } from '../dto/curated-profile.output';
import { CuratedProfileComposer } from '../services/curated-profile.composer';
import {
  ExportCuratedProfileResumeForAdminUseCase,
  ExportCuratedProfileResumeUseCase,
} from './export-curated-profile-resume.use-case';
import { ResolveCuratedProfileUseCase } from './resolve-curated-profile.use-case';

const BASE = 'https://ejemplo.dev';

function view(
  visibility: CuratedProfileOutput['visibility'] = 'PUBLIC',
  slug = 'ejemplo-backend',
): CuratedProfileOutput {
  return {
    slug,
    visibility,
    headline: 'Titular',
    updatedAt: '2026-01-15T12:00:00.000Z',
    sections: ['hero'],
    profile: null,
    experiences: [],
    skillCategories: [],
    projects: [],
    education: [],
    certifications: [],
    socialLinks: [],
  } as unknown as CuratedProfileOutput;
}

describe('ExportCuratedProfileResumeUseCase', () => {
  function build(result: Awaited<ReturnType<ResolveCuratedProfileUseCase['execute']>>) {
    const execute = jest.fn().mockResolvedValue(result);
    const resolve = { execute } as unknown as ResolveCuratedProfileUseCase;
    return { useCase: new ExportCuratedProfileResumeUseCase(resolve), execute };
  }

  it('mapea la vista resuelta y devuelve slug canónico y visibilidad para las cabeceras', async () => {
    const { useCase } = build(ok(view('PROTECTED', 'ejemplo-renombrado')));
    const result = await useCase.execute({
      slug: 'ejemplo-nombre-anterior',
      locale: 'en',
      accessToken: 'tok',
      baseUrl: BASE,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.slug).toBe('ejemplo-renombrado');
    expect(result.value.visibility).toBe('PROTECTED');
    expect(result.value.document.meta.canonical).toBe(
      `${BASE}/api/curated-profiles/ejemplo-renombrado/resume.json?lang=en`,
    );
  });

  it('nunca pasa viewContext: exportar no registra visita (D2)', async () => {
    const { useCase, execute } = build(ok(view()));
    await useCase.execute({ slug: 'ejemplo-backend', locale: 'es', baseUrl: BASE });
    expect(execute).toHaveBeenCalledTimes(1);
    const [input] = execute.mock.calls[0] as [Record<string, unknown>];
    expect(input).not.toHaveProperty('viewContext');
    expect(input).toEqual({ slug: 'ejemplo-backend', locale: 'es', accessToken: undefined });
  });

  it('propaga el 404 tal cual', async () => {
    const error = new CuratedProfileNotFoundError('x');
    const { useCase } = build(fail(error));
    const result = await useCase.execute({ slug: 'x', locale: 'es', baseUrl: BASE });
    expect(result).toEqual({ ok: false, error });
  });

  it('propaga el 401 tal cual', async () => {
    const error = new CuratedProfileAccessDeniedError();
    const { useCase } = build(fail(error));
    const result = await useCase.execute({ slug: 'x', locale: 'es', baseUrl: BASE });
    expect(result).toEqual({ ok: false, error });
  });

  it('el token de acceso no aparece en el documento', async () => {
    const { useCase } = build(ok(view('PROTECTED')));
    const result = await useCase.execute({
      slug: 'ejemplo-backend',
      locale: 'es',
      accessToken: 'secreto-del-perfil',
      baseUrl: BASE,
    });
    expect(JSON.stringify(result)).not.toContain('secreto-del-perfil');
  });
});

describe('ExportCuratedProfileResumeForAdminUseCase', () => {
  function build(found: CuratedProfile | null, output = view()) {
    const findById = jest.fn().mockResolvedValue(found);
    const repo = { findById } as unknown as CuratedProfileRepository;
    const compose = jest.fn().mockResolvedValue(output);
    const composer = { compose } as unknown as CuratedProfileComposer;
    return {
      useCase: new ExportCuratedProfileResumeForAdminUseCase(repo, composer),
      findById,
      compose,
    };
  }

  function curated(visibility: string, archivedAt: Date | null): CuratedProfile {
    return {
      id: 'cp1',
      slug: 'ejemplo-backend',
      visibility,
      archivedAt,
    } as unknown as CuratedProfile;
  }

  it('un perfil PRIVATE da documento (no evalúa la visibilidad)', async () => {
    const { useCase, compose } = build(curated('PRIVATE', null), view('PRIVATE'));
    const result = await useCase.execute({ id: 'cp1', locale: 'es', baseUrl: BASE });
    expect(result.ok).toBe(true);
    expect(compose).toHaveBeenCalledWith(expect.anything(), 'es');
  });

  it('un perfil archivado también da documento', async () => {
    const { useCase } = build(curated('PUBLIC', new Date('2026-10-01')));
    const result = await useCase.execute({ id: 'cp1', locale: 'en', baseUrl: BASE });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.document.meta.canonical).toContain('lang=en');
  });

  it('un id inexistente da CuratedProfileNotFoundError y no compone', async () => {
    const { useCase, compose } = build(null);
    const result = await useCase.execute({ id: 'nope', locale: 'es', baseUrl: BASE });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(CuratedProfileNotFoundError);
    expect(compose).not.toHaveBeenCalled();
  });
});

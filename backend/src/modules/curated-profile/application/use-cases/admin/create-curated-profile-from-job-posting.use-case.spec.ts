import { NotFoundError } from '../../../../../shared/domain/errors';
import { collectTagVocabulary } from '../../../../../shared/domain/tag-vocabulary';
import { JobPostingDraftSource } from '../../../../job-posting/application/ports/job-posting.reader';
import { ThemeRepository } from '../../../../theme/domain/repositories/theme.repository';
import {
  CuratedProfile,
  NewCuratedProfileProps,
} from '../../../domain/entities/curated-profile.entity';
import { CuratedProfileRepository } from '../../../domain/repositories/curated-profile.repository';
import { CreateCuratedProfileUseCase } from './curated-profile-admin.use-cases';
import { CreateCuratedProfileFromJobPostingUseCase } from './create-curated-profile-from-job-posting.use-case';

const POSTING: JobPostingDraftSource = {
  id: 'jp1',
  title: 'Tech Lead Backend',
  company: 'Acme Ejemplo',
  language: 'es',
};

class FakeRepo {
  readonly taken = new Set<string>();
  readonly created: NewCuratedProfileProps[] = [];
  existsBySlug = jest.fn((slug: string) => Promise.resolve(this.taken.has(slug)));
  create = jest.fn((props: NewCuratedProfileProps) => {
    this.created.push(props);
    const now = new Date();
    return Promise.resolve(
      CuratedProfile.create({
        ...props,
        id: 'cp1',
        views: 0,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      }),
    );
  });
}

function setup(options: { posting?: JobPostingDraftSource | null; tags?: string[] } = {}) {
  const repo = new FakeRepo();
  const themes = { findById: jest.fn() } as unknown as ThemeRepository;
  const reader = {
    findDraftSource: jest.fn(() =>
      Promise.resolve(options.posting === undefined ? POSTING : options.posting),
    ),
  };
  const vocabulary = {
    read: () =>
      Promise.resolve(
        collectTagVocabulary(
          (options.tags ?? ['java', 'spring-boot', 'kubernetes']).map((tag) => ({
            tags: [tag],
            visible: true,
          })),
        ),
      ),
  };
  const create = new CreateCuratedProfileUseCase(
    repo as unknown as CuratedProfileRepository,
    themes,
  );
  const useCase = new CreateCuratedProfileFromJobPostingUseCase(
    reader,
    vocabulary,
    repo as unknown as CuratedProfileRepository,
    create,
  );
  return { repo, reader, useCase };
}

describe('CreateCuratedProfileFromJobPostingUseCase (D17)', () => {
  it('crea un perfil PRIVATE, no enumerado, sin token y con headline vacío', async () => {
    const { useCase, repo } = setup();
    const result = await useCase.execute({
      jobPostingId: 'jp1',
      filterTags: ['java', 'spring-boot'],
    });
    expect(result.ok).toBe(true);
    const [props] = repo.created;
    expect(props).toMatchObject({
      slug: 'acme-ejemplo-tech-lead-backend',
      title: { es: 'Tech Lead Backend', en: 'Tech Lead Backend' },
      headline: {},
      description: null,
      roleType: null,
      techFocus: null,
      filterTags: ['java', 'spring-boot'],
      includeIds: [],
      excludeIds: [],
      themeId: null,
      layout: 'classic',
      sectionsOrder: [],
      visibility: 'PRIVATE',
      listed: false,
    });
    expect(props.accessToken.isSet).toBe(false);
    if (result.ok) {
      expect(result.value.visibility).toBe('PRIVATE');
      expect(result.value.listed).toBe(false);
    }
  });

  it('una vacante inexistente da 404 y no escribe', async () => {
    const { useCase, repo } = setup({ posting: null });
    const result = await useCase.execute({ jobPostingId: 'nope', filterTags: ['java'] });
    expect(!result.ok && result.error).toBeInstanceOf(NotFoundError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('un tag fuera del vocabulario da 400 que lo nombra, sin escribir', async () => {
    const { useCase, repo } = setup();
    const result = await useCase.execute({
      jobPostingId: 'jp1',
      filterTags: ['java', 'inventado', 'otro-falso'],
    });
    expect(!result.ok && result.error.code).toBe('VALIDATION_ERROR');
    expect(!result.ok && result.error.message).toContain('inventado, otro-falso');
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('tags vacíos o repetidos dan 400 sin escribir', async () => {
    const { useCase, repo } = setup();
    expect((await useCase.execute({ jobPostingId: 'jp1', filterTags: [] })).ok).toBe(false);
    expect((await useCase.execute({ jobPostingId: 'jp1', filterTags: ['java', 'java'] })).ok).toBe(
      false,
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('el owner puede elegir cualquier tag del vocabulario, no solo los sugeridos', async () => {
    const { useCase } = setup();
    expect((await useCase.execute({ jobPostingId: 'jp1', filterTags: ['kubernetes'] })).ok).toBe(
      true,
    );
  });

  it('deriva el slug con el primer sufijo libre', async () => {
    const { useCase, repo } = setup();
    repo.taken.add('acme-ejemplo-tech-lead-backend');
    repo.taken.add('acme-ejemplo-tech-lead-backend-2');
    const result = await useCase.execute({ jobPostingId: 'jp1', filterTags: ['java'] });
    expect(result.ok && result.value.slug).toBe('acme-ejemplo-tech-lead-backend-3');
  });

  it('sin slug libre hasta -50: 409', async () => {
    const { useCase, repo } = setup();
    repo.existsBySlug.mockResolvedValue(true);
    const result = await useCase.execute({ jobPostingId: 'jp1', filterTags: ['java'] });
    expect(!result.ok && result.error.code).toBe('PERFIL_CURADO_CONFLICT');
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('un slug elegido ocupado da 409 y uno libre se respeta', async () => {
    const { useCase, repo } = setup();
    repo.taken.add('mi-perfil');
    const busy = await useCase.execute({
      jobPostingId: 'jp1',
      filterTags: ['java'],
      slug: 'mi-perfil',
    });
    expect(!busy.ok && busy.error.code).toMatch(/CONFLICT/);
    const free = await useCase.execute({
      jobPostingId: 'jp1',
      filterTags: ['java'],
      slug: 'mi-otro',
    });
    expect(free.ok && free.value.slug).toBe('mi-otro');
  });

  it('un slug que no es kebab-case da 400', async () => {
    const { useCase } = setup();
    const result = await useCase.execute({
      jobPostingId: 'jp1',
      filterTags: ['java'],
      slug: 'Mi Perfil',
    });
    expect(!result.ok && result.error.code).toBe('VALIDATION_ERROR');
  });

  it('usa el título dado en ES y EN', async () => {
    const { useCase, repo } = setup();
    await useCase.execute({ jobPostingId: 'jp1', filterTags: ['java'], title: ' Para Acme ' });
    expect(repo.created[0].title).toEqual({ es: 'Para Acme', en: 'Para Acme' });
  });
});

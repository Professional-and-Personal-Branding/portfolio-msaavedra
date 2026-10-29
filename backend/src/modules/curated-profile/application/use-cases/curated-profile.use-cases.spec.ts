import { Logger } from '@nestjs/common';
import { ProfileViewRepository } from '../../../analytics/domain/repositories/profile-view.repository';
import { Certification } from '../../../education/domain/entities/certification.entity';
import { Education } from '../../../education/domain/entities/education.entity';
import { Project } from '../../../project/domain/entities/project.entity';
import { SocialLink } from '../../../social-link/domain/entities/social-link.entity';
import { BackgroundTasks } from '../../../../shared/application/background-tasks';
import { CuratedProfileComposer } from '../services/curated-profile.composer';
import { PortfolioSectionsLoader } from '../services/portfolio-sections.loader';
import { Experience } from '../../../experience/domain/entities/experience.entity';
import { ExperienceRepository } from '../../../experience/domain/repositories/experience.repository';
import { Profile } from '../../../profile/domain/entities/profile.entity';
import { ProfileRepository } from '../../../profile/domain/repositories/profile.repository';
import { Availability } from '../../../profile/domain/value-objects/availability.vo';
import { SkillCategory } from '../../../skill/domain/entities/skill-category.entity';
import { Skill } from '../../../skill/domain/entities/skill.entity';
import { SkillCategoryRepository } from '../../../skill/domain/repositories/skill-category.repository';
import { Theme } from '../../../theme/domain/entities/theme.entity';
import { ThemeRepository } from '../../../theme/domain/repositories/theme.repository';
import {
  CuratedProfile,
  CuratedProfileProps,
  NewCuratedProfileProps,
} from '../../domain/entities/curated-profile.entity';
import { CuratedProfileAccessDeniedError } from '../../domain/errors/curated-profile-access-denied.error';
import { CuratedProfileNotFoundError } from '../../domain/errors/curated-profile-not-found.error';
import { CuratedProfileRepository } from '../../domain/repositories/curated-profile.repository';
import { ShareLink } from '../../domain/entities/share-link.entity';
import { ShareLinkRepository } from '../../domain/repositories/share-link.repository';
import { AccessToken } from '../../domain/value-objects/access-token.vo';
import { PreviewCuratedProfileUseCase } from './admin/preview-curated-profile.use-case';
import { ListCuratedProfilesUseCase } from './list-curated-profiles.use-case';
import { ResolveCuratedProfileUseCase } from './resolve-curated-profile.use-case';

// ── Fixtures ────────────────────────────────────────────────────────────────
function exp(id: string, startDate: string, tags: string[], order = 0, visible = true): Experience {
  return Experience.create({
    id,
    company: id,
    role: { es: `Rol ${id}`, en: `Role ${id}` },
    startDate,
    endDate: null,
    current: false,
    location: 'Remoto',
    summary: { es: 'Resumen', en: 'Summary' },
    highlights: { es: ['logro'], en: ['achievement'] },
    technologies: [],
    tags,
    sector: [],
    order,
    visible,
  });
}

const EXPERIENCES = [
  exp('novacomp', '2026-03', ['dotnet', 'java', 'fintech'], 0),
  exp('kiwox', '2022-04', ['nodejs', 'aws'], 6),
  exp('vidoomy', '2022-02', ['java'], 5),
  exp('ypfb', '2018-02', ['dotnet', 'legacy'], 14),
  exp('oculta', '2030-01', ['java'], 99, false),
];

const CATEGORIES = [
  SkillCategory.create({
    id: 'c1',
    name: { es: 'Lenguajes', en: 'Languages' },
    order: 0,
    skills: [
      Skill.create({ id: 's-java', name: 'Java', tags: ['java'], order: 0 }),
      Skill.create({ id: 's-cs', name: 'C#', tags: ['dotnet'], order: 1 }),
    ],
  }),
  SkillCategory.create({
    id: 'c2',
    name: { es: 'Metodologías', en: 'Methodologies' },
    order: 1,
    skills: [Skill.create({ id: 's-scrum', name: 'Scrum', tags: ['leadership'], order: 0 })],
  }),
];

const MODERN_DARK = Theme.create({
  id: 't-md',
  name: 'Modern Dark',
  slug: 'modern-dark',
  isPreset: true,
  tokens: { mode: 'dark', colors: { bg: '#0a0e1a', accent: '#38bdf8' } },
});
const ELEGANT = Theme.create({
  id: 't-el',
  name: 'Elegant',
  slug: 'elegant',
  isPreset: true,
  tokens: { mode: 'dark', colors: { bg: '#1a1814', accent: '#c8a04e' } },
});

const PROFILE = Profile.create({
  id: 'p1',
  fullName: 'Manuel',
  headline: { es: 'Ingeniero', en: 'Engineer' },
  location: 'SCZ',
  timezone: 'GMT-4',
  email: 'm@x.com',
  phone: null,
  summary: { es: 'Resumen', en: 'Summary' },
  yearsOfExperience: 10,
  availability: Availability.create({ modality: null, contractType: null, startDate: null }),
  languages: [],
});

function curated(overrides: Partial<CuratedProfileProps> = {}): CuratedProfile {
  return CuratedProfile.create({
    id: 'cp1',
    slug: 'java-senior',
    title: { es: 'Java Senior', en: 'Senior Java' },
    headline: { es: 'Titular', en: 'Headline' },
    description: { es: 'Desc', en: 'Description' },
    roleType: { es: 'Backend', en: 'Backend' },
    techFocus: 'Java',
    filterTags: ['java'],
    includeIds: [],
    excludeIds: [],
    themeId: null,
    themeOverrides: null,
    layout: 'classic',
    sectionsOrder: [],
    sectionsHidden: [],
    visibility: 'PUBLIC',
    accessToken: AccessToken.none(),
    views: 0,
    ...overrides,
  });
}

const PROJECTS = [
  Project.create({
    id: 'proj-erp',
    name: 'ERP AWA',
    role: { es: 'Líder', en: 'Lead' },
    period: '2019',
    summary: { es: 'x' },
    technologies: [],
    tags: ['erp', 'java'],
    url: null,
    order: 1,
    visible: true,
  }),
  Project.create({
    id: 'proj-web',
    name: 'Portafolio',
    role: { es: 'Autor', en: 'Author' },
    period: '2026',
    summary: { es: 'y' },
    technologies: [],
    tags: ['nodejs'],
    url: null,
    order: 0,
    visible: true,
  }),
];
const EDUCATION = [
  Education.create({
    id: 'edu-1',
    degree: { es: 'Doctorado', en: 'PhD' },
    institution: 'UAGRM',
    startDate: '2024-02',
    endDate: null,
    inProgress: true,
    order: 0,
    visible: true,
  }),
];
const CERTIFICATIONS = [
  Certification.create({
    id: 'cert-1',
    name: { es: 'Scrum', en: 'Scrum' },
    issuer: 'X',
    year: '2021',
    verificationUrl: 'https://example.org/c/1',
    credentialId: 'EJ-1',
    expiresAt: '2029-06',
    order: 0,
    visible: true,
  }),
];
const SOCIAL_LINKS = [
  SocialLink.create({
    id: 'sl-1',
    platform: 'github',
    handle: 'manu',
    url: 'https://github.com/manu',
    label: { es: 'Código', en: 'Code' },
    description: null,
    stats: { repos: 67 },
    featured: true,
    order: 0,
    visible: true,
  }),
];

const stubs = () => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

interface Deps {
  curated?: CuratedProfile | null;
  profile?: Profile | null;
  experiences?: Experience[];
  categories?: SkillCategory[];
  themes?: Theme[];
  record?: jest.Mock;
  findByCode?: jest.Mock;
  isAdminSession?: jest.Mock;
}

function build(deps: Deps = {}) {
  const themes = deps.themes ?? [MODERN_DARK, ELEGANT];
  const curatedRepo: CuratedProfileRepository = {
    ...stubs(),
    existsBySlug: jest.fn(),
    findBySlug: jest.fn().mockResolvedValue(deps.curated === undefined ? curated() : deps.curated),
    findBySlugOrAlias: jest
      .fn()
      .mockResolvedValue(deps.curated === undefined ? curated() : deps.curated),
    findAllPublic: jest.fn().mockResolvedValue([]),
  };
  const profileRepo: ProfileRepository = {
    findOne: jest.fn().mockResolvedValue(deps.profile === undefined ? PROFILE : deps.profile),
    save: jest.fn(),
  };
  const experienceRepo: ExperienceRepository = {
    ...stubs(),
    findAllVisible: jest
      .fn()
      .mockResolvedValue((deps.experiences ?? EXPERIENCES).filter((e) => e.visible)),
    findVisibleById: jest.fn(),
  };
  const skillRepo: SkillCategoryRepository = {
    ...stubs(),
    findSkillById: jest.fn(),
    createSkill: jest.fn(),
    updateSkill: jest.fn(),
    deleteSkill: jest.fn(),
    findAll: jest.fn().mockResolvedValue(deps.categories ?? CATEGORIES),
  };
  const themeRepo: ThemeRepository = {
    findById: jest
      .fn()
      .mockImplementation((id: string) => Promise.resolve(themes.find((t) => t.id === id) ?? null)),
    findBySlug: jest
      .fn()
      .mockImplementation((slug: string) =>
        Promise.resolve(themes.find((t) => t.slug === slug) ?? null),
      ),
    findAll: jest.fn().mockResolvedValue(themes),
  };
  const record = deps.record ?? jest.fn().mockResolvedValue(undefined);
  const viewsRepo: ProfileViewRepository = {
    record,
    aggregate: jest.fn(),
    countByReferrer: jest.fn(),
    countByKind: jest.fn(),
    countByShareLink: jest.fn(),
    countBySource: jest.fn(),
    countOpensByShareLink: jest.fn(),
  };
  const findByCode = deps.findByCode ?? jest.fn().mockResolvedValue(null);
  const shareLinks: ShareLinkRepository = {
    findByCode,
    findById: jest.fn(),
    listByProfile: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findActiveLinkedIn: jest.fn(),
  };
  const isAdminSession = deps.isAdminSession ?? jest.fn().mockResolvedValue(false);
  const sessions = { isAdminSession };
  const loader = {
    load: jest.fn().mockResolvedValue({
      education: EDUCATION,
      certifications: CERTIFICATIONS,
      projects: PROJECTS,
      socialLinks: SOCIAL_LINKS,
    }),
  } as unknown as PortfolioSectionsLoader;
  const composer = new CuratedProfileComposer(
    profileRepo,
    experienceRepo,
    skillRepo,
    themeRepo,
    loader,
  );
  const background = new FakeBackgroundTasks();
  const useCase = new ResolveCuratedProfileUseCase(
    curatedRepo,
    viewsRepo,
    shareLinks,
    background,
    sessions,
    composer,
  );
  return { useCase, record, findByCode, isAdminSession, loader, composer, curatedRepo, background };
}

/** Captura las tareas sin ejecutarlas: permite comprobar que la respuesta no las espera. */
class FakeBackgroundTasks implements BackgroundTasks {
  readonly captured: { name: string; task: () => Promise<void> }[] = [];
  run(name: string, task: () => Promise<void>): void {
    this.captured.push({ name, task });
  }
  async flush(): Promise<void> {
    for (const { task } of this.captured) await task();
  }
  whenIdle(): Promise<void> {
    return Promise.resolve();
  }
  drain(): Promise<void> {
    return Promise.resolve();
  }
}

async function resolveOk(useCase: ResolveCuratedProfileUseCase, input = {}) {
  const result = await useCase.execute({ slug: 'java-senior', locale: 'es', ...input });
  if (!result.ok) throw new Error(`esperaba éxito, obtuve ${result.error.code}`);
  return result.value;
}

// ── ResolveCuratedProfileUseCase ─────────────────────────────────────────────
describe('ResolveCuratedProfileUseCase', () => {
  it('perfil público: selecciona por tags y ordena cronológicamente', async () => {
    const out = await resolveOk(build().useCase);
    expect(out.slug).toBe('java-senior');
    expect(out.experiences.map((e) => e.id)).toEqual(['novacomp', 'vidoomy']);
    expect(out.visibility).toBe('PUBLIC');
  });

  it('slug inexistente → CuratedProfileNotFoundError', async () => {
    const result = await build({ curated: null }).useCase.execute({ slug: 'nope', locale: 'es' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(CuratedProfileNotFoundError);
    expect(result.error.message).toContain('nope');
  });

  it('PRIVATE se comporta como inexistente, con o sin token', async () => {
    const { useCase } = build({
      curated: curated({ visibility: 'PRIVATE', accessToken: AccessToken.create('t') }),
    });
    const sin = await useCase.execute({ slug: 'java-senior', locale: 'es' });
    const con = await useCase.execute({ slug: 'java-senior', locale: 'es', accessToken: 't' });
    expect(sin.ok).toBe(false);
    expect(con.ok).toBe(false);
    if (!sin.ok) expect(sin.error).toBeInstanceOf(CuratedProfileNotFoundError);
    if (!con.ok) expect(con.error).toBeInstanceOf(CuratedProfileNotFoundError);
  });

  it('PROTECTED sin token o con token incorrecto → AccessDenied', async () => {
    const { useCase } = build({
      curated: curated({ visibility: 'PROTECTED', accessToken: AccessToken.create('s3cret') }),
    });
    const sin = await useCase.execute({ slug: 'java-senior', locale: 'es' });
    const mal = await useCase.execute({ slug: 'java-senior', locale: 'es', accessToken: 'otro' });
    expect(sin.ok).toBe(false);
    expect(mal.ok).toBe(false);
    if (!sin.ok) expect(sin.error).toBeInstanceOf(CuratedProfileAccessDeniedError);
    if (!mal.ok) expect(mal.error.code).toBe('PERFIL_CURADO_ACCESS_DENIED');
  });

  it('PROTECTED con token válido resuelve', async () => {
    const { useCase } = build({
      curated: curated({ visibility: 'PROTECTED', accessToken: AccessToken.create('s3cret') }),
    });
    const out = await resolveOk(useCase, { accessToken: 's3cret' });
    expect(out.visibility).toBe('PROTECTED');
  });

  it('filterTags vacío incluye todas las visibles', async () => {
    const out = await resolveOk(build({ curated: curated({ filterTags: [] }) }).useCase);
    expect(out.experiences.map((e) => e.id)).toEqual(['novacomp', 'kiwox', 'vidoomy', 'ypfb']);
  });

  it('excludeIds gana; includeIds fuerza', async () => {
    const out = await resolveOk(
      build({ curated: curated({ includeIds: ['kiwox'], excludeIds: ['novacomp'] }) }).useCase,
    );
    expect(out.experiences.map((e) => e.id)).toEqual(['kiwox', 'vidoomy']);
  });

  it('una experiencia oculta no entra ni con includeIds', async () => {
    const out = await resolveOk(build({ curated: curated({ includeIds: ['oculta'] }) }).useCase);
    expect(out.experiences.map((e) => e.id)).not.toContain('oculta');
  });

  it('skills reagrupadas por categoría sin categorías vacías', async () => {
    const out = await resolveOk(build().useCase);
    expect(out.skillCategories).toEqual([{ name: 'Lenguajes', skills: ['Java'] }]);
  });

  it('tema: sin themeId usa modern-dark; con themeId usa el propio; overrides se mergean', async () => {
    const def = await resolveOk(build().useCase);
    expect(def.theme?.slug).toBe('modern-dark');

    const own = await resolveOk(
      build({
        curated: curated({ themeId: 't-el', themeOverrides: { colors: { accent: '#fff' } } }),
      }).useCase,
    );
    expect(own.theme?.slug).toBe('elegant');
    expect(own.theme?.tokens).toEqual({ mode: 'dark', colors: { bg: '#1a1814', accent: '#fff' } });
    expect(ELEGANT.tokens.colors).toEqual({ bg: '#1a1814', accent: '#c8a04e' }); // base intacto
  });

  it('themeId inexistente cae a modern-dark; sin ningún tema → null', async () => {
    const fallback = await resolveOk(build({ curated: curated({ themeId: 'no-existe' }) }).useCase);
    expect(fallback.theme?.slug).toBe('modern-dark');

    const none = await resolveOk(build({ themes: [] }).useCase);
    expect(none.theme).toBeNull();
    expect(none.experiences.length).toBeGreaterThan(0);
  });

  it('secciones: orden custom con ocultas y default cuando está vacío', async () => {
    const custom = await resolveOk(
      build({
        curated: curated({
          sectionsOrder: ['hero', 'skills', 'contact'],
          sectionsHidden: ['skills'],
        }),
      }).useCase,
    );
    // Lo declarado primero; después el relleno, en orden canónico y sin la oculta.
    expect(custom.sections).toEqual([
      'hero',
      'contact',
      'stats',
      'experience',
      'projects',
      'education',
      'certifications',
      'presence',
    ]);
    expect(custom.hiddenSections).toEqual(['skills']);

    const def = await resolveOk(build().useCase);
    expect(def.sections).toEqual([
      'hero',
      'stats',
      'experience',
      'skills',
      'projects',
      'education',
      'certifications',
      'presence',
      'contact',
    ]);
  });

  // unify-section-catalog: el composer aplica el relleno y devuelve el orden final.
  it('una sección con datos omitida del orden se agrega al final', async () => {
    const out = await resolveOk(
      build({ curated: curated({ sectionsOrder: ['hero', 'experience'] }) }).useCase,
    );
    expect(out.projects.length).toBeGreaterThan(0);
    expect(out.sections.slice(0, 2)).toEqual(['hero', 'experience']);
    expect(out.sections).toContain('projects');
    expect(out.sections.indexOf('projects')).toBeGreaterThan(1);
  });

  it('sin proyectos tras el filtro, projects no se rellena ni aunque esté declarado', async () => {
    const omitida = await resolveOk(
      build({ curated: curated({ sectionsOrder: ['hero'], excludeIds: ['proj-erp'] }) }).useCase,
    );
    expect(omitida.projects).toEqual([]);
    expect(omitida.sections).not.toContain('projects');

    const declarada = await resolveOk(
      build({
        curated: curated({ sectionsOrder: ['hero', 'projects'], excludeIds: ['proj-erp'] }),
      }).useCase,
    );
    expect(declarada.sections).not.toContain('projects');
  });

  it('una sección oculta no se rellena', async () => {
    const out = await resolveOk(
      build({ curated: curated({ sectionsOrder: ['hero'], sectionsHidden: ['projects'] }) })
        .useCase,
    );
    expect(out.projects.length).toBeGreaterThan(0);
    expect(out.sections).not.toContain('projects');
    expect(out.hiddenSections).toContain('projects');
  });

  it('locale en aplica a todo el árbol y no quedan objetos {es,en}', async () => {
    const out = await resolveOk(build().useCase, { locale: 'en' });
    expect(out.title).toBe('Senior Java');
    expect(out.profile?.headline).toBe('Engineer');
    expect(out.experiences[0].role).toBe('Role novacomp');
    expect(out.skillCategories[0].name).toBe('Languages');
    const json = JSON.stringify(out);
    expect(json).not.toMatch(/"es":/);
    expect(json).not.toMatch(/"en":/);
  });

  it('no expone datos sensibles ni internos', async () => {
    const out = (await resolveOk(
      build({
        curated: curated({ visibility: 'PROTECTED', accessToken: AccessToken.create('s3cret') }),
      }).useCase,
      { accessToken: 's3cret' },
    )) as unknown as Record<string, unknown>;
    for (const key of [
      'accessToken',
      'includeIds',
      'excludeIds',
      'filterTags',
      'themeId',
      'themeOverrides',
    ]) {
      expect(out).not.toHaveProperty(key);
    }
    expect(JSON.stringify(out)).not.toContain('s3cret');
  });

  it('forma completa del resultado', async () => {
    const out = await resolveOk(build().useCase);
    expect(Object.keys(out).sort()).toEqual(
      [
        'slug',
        'title',
        'headline',
        'description',
        'roleType',
        'techFocus',
        'layout',
        'visibility',
        'sections',
        'hiddenSections',
        'theme',
        'profile',
        'experiences',
        'skillCategories',
        'projects',
        'education',
        'certifications',
        'socialLinks',
      ].sort(),
    );
  });

  it('sin perfil base → profile null, resolución continúa', async () => {
    const out = await resolveOk(build({ profile: null }).useCase);
    expect(out.profile).toBeNull();
    expect(out.experiences).toHaveLength(2);
  });

  // ── Registro de visitas (spec curated-profile-resolution / profile-view-analytics) ──
  describe('registro de visita', () => {
    it('con viewContext registra la visita y el resultado es el mismo que sin contexto', async () => {
      const withCtx = build();
      const withoutCtx = build();
      const a = await resolveOk(withCtx.useCase, {
        viewContext: { locale: 'es', referrer: 'https://x', userAgent: 'UA', ipHash: 'h' },
      });
      const b = await resolveOk(withoutCtx.useCase);
      await withCtx.background.flush();
      expect(a).toEqual(b);
      expect(withCtx.background.captured.map((t) => t.name)).toEqual(['record-profile-view']);
      expect(withCtx.record).toHaveBeenCalledWith({
        curatedProfileId: 'cp1',
        locale: 'es',
        referrer: 'https://x',
        userAgent: 'UA',
        ipHash: 'h',
        kind: 'HUMAN',
        shareLinkId: null,
        source: null,
      });
      expect(withoutCtx.background.captured).toHaveLength(0);
      expect(withoutCtx.record).not.toHaveBeenCalled();
    });

    it('responde antes de escribir: el repositorio no se llama hasta que corre la tarea', async () => {
      const built = build();
      const out = await resolveOk(built.useCase, { viewContext: { locale: 'es' } });
      expect(out.slug).toBe('java-senior');
      expect(built.background.captured).toHaveLength(1);
      expect(built.record).not.toHaveBeenCalled();
      await built.background.flush();
      expect(built.record).toHaveBeenCalledTimes(1);
    });

    it('no registra cuando el acceso es denegado o el perfil no existe', async () => {
      const denied = build({
        curated: curated({ visibility: 'PROTECTED', accessToken: AccessToken.create('t') }),
      });
      await denied.useCase.execute({ slug: 'x', locale: 'es', viewContext: { locale: 'es' } });
      expect(denied.background.captured).toHaveLength(0);
      expect(denied.record).not.toHaveBeenCalled();

      const missing = build({ curated: null });
      await missing.useCase.execute({ slug: 'x', locale: 'es', viewContext: { locale: 'es' } });
      expect(missing.background.captured).toHaveLength(0);
      expect(missing.record).not.toHaveBeenCalled();
    });

    it('un fallo del registro no altera el resultado exitoso ni rechaza la tarea', async () => {
      const failing = build({ record: jest.fn().mockRejectedValue(new Error('db down')) });
      const out = await resolveOk(failing.useCase, { viewContext: { locale: 'en' } });
      expect(out.slug).toBe('java-senior');
      await expect(failing.background.flush()).resolves.toBeUndefined();
      expect(failing.record).toHaveBeenCalled();
    });

    // ── Clasificación de la visita (change classify-profile-views) ──
    const BROWSER_UA =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const BOT_UA = 'Mozilla/5.0 AppleWebKit/537.36 HeadlessChrome/120.0.0.0 Safari/537.36';

    /** `kind` de la primera visita que recibió el repositorio. */
    const firstKind = (record: jest.Mock): string =>
      (record.mock.calls as [{ kind: string }][])[0][0].kind;

    async function recordedKind(
      viewContext: { userAgent?: string; sessionToken?: string },
      deps: Deps = {},
    ) {
      const built = build(deps);
      await resolveOk(built.useCase, { viewContext: { locale: 'es', ...viewContext } });
      await built.background.flush();
      return { built, kind: firstKind(built.record) };
    }

    it('sin token: UA de navegador es HUMAN y UA de bot o ausente es BOT', async () => {
      expect((await recordedKind({ userAgent: BROWSER_UA })).kind).toBe('HUMAN');
      expect((await recordedKind({ userAgent: BOT_UA })).kind).toBe('BOT');
      expect((await recordedKind({})).kind).toBe('BOT');
    });

    it('sin token no se llama al verificador', async () => {
      const { built } = await recordedKind({ userAgent: BROWSER_UA });
      expect(built.isAdminSession).not.toHaveBeenCalled();
    });

    it('token válido: OWNER aunque el UA sea de bot, y el token no llega al repositorio', async () => {
      const { built, kind } = await recordedKind(
        { userAgent: BOT_UA, sessionToken: 'jwt-secreto' },
        { isAdminSession: jest.fn().mockResolvedValue(true) },
      );
      expect(kind).toBe('OWNER');
      expect(built.isAdminSession).toHaveBeenCalledWith('jwt-secreto');
      expect(JSON.stringify(built.record.mock.calls)).not.toContain('jwt-secreto');
    });

    it('token que el verificador rechaza: se clasifica por UA', async () => {
      const { kind } = await recordedKind(
        { userAgent: BROWSER_UA, sessionToken: 'vencido' },
        { isAdminSession: jest.fn().mockResolvedValue(false) },
      );
      expect(kind).toBe('HUMAN');
    });

    it('responde antes de validar la sesión: el verificador pendiente no demora a execute()', async () => {
      let release: (value: boolean) => void = () => undefined;
      const pending = new Promise<boolean>((resolve) => {
        release = resolve;
      });
      const withToken = build({ isAdminSession: jest.fn().mockReturnValue(pending) });
      const withoutToken = build();
      const a = await resolveOk(withToken.useCase, {
        viewContext: { locale: 'es', userAgent: BROWSER_UA, sessionToken: 't' },
      });
      const b = await resolveOk(withoutToken.useCase, {
        viewContext: { locale: 'es', userAgent: BROWSER_UA },
      });
      expect(a).toEqual(b);
      expect(withToken.isAdminSession).not.toHaveBeenCalled(); // recién corre dentro de la tarea
      const flushing = withToken.background.flush();
      await Promise.resolve();
      expect(withToken.record).not.toHaveBeenCalled(); // sigue esperando al verificador
      release(true);
      await flushing;
      expect(firstKind(withToken.record)).toBe('OWNER');
    });

    it('si el verificador falla: clasifica sin sesión, avisa sin el token y no rechaza', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      try {
        const built = build({
          isAdminSession: jest.fn().mockRejectedValue(new Error('jwt-secreto: base caída')),
        });
        await resolveOk(built.useCase, {
          viewContext: { locale: 'es', userAgent: BROWSER_UA, sessionToken: 'jwt-secreto' },
        });
        await expect(built.background.flush()).resolves.toBeUndefined();
        expect(firstKind(built.record)).toBe('HUMAN');
        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0][0])).not.toContain('jwt-secreto');
      } finally {
        warn.mockRestore();
      }
    });

    it('sin viewContext no se llama ni al verificador ni a record', async () => {
      const built = build();
      await resolveOk(built.useCase);
      await built.background.flush();
      expect(built.isAdminSession).not.toHaveBeenCalled();
      expect(built.record).not.toHaveBeenCalled();
    });

    // ── Atribución por enlace de seguimiento (change add-share-links) ──
    describe('atribución', () => {
      const CODE = 'k7m2q9xw4t';
      const link = (over: Partial<ConstructorParameters<typeof ShareLink>[0]> = {}) =>
        new ShareLink({
          id: 'sl1',
          code: CODE,
          curatedProfileId: 'cp1',
          label: 'Acme',
          portal: null,
          kind: 'MANUAL',
          createdAt: new Date('2026-10-01T00:00:00Z'),
          revokedAt: null,
          ...over,
        });

      /** Corre una visita con `via`/`src` y devuelve lo que recibió `record`. */
      async function recorded(ctx: { via?: string; src?: string }, found: ShareLink | null) {
        const built = build({ findByCode: jest.fn().mockResolvedValue(found) });
        await resolveOk(built.useCase, { viewContext: { locale: 'es', userAgent: 'UA', ...ctx } });
        await built.background.flush();
        const [view] = built.record.mock.calls[0] as [
          { shareLinkId: string | null; source: string | null },
        ];
        return { built, view };
      }

      it('enlace activo del perfil: guarda su id', async () => {
        const { built, view } = await recorded({ via: CODE }, link());
        expect(built.findByCode).toHaveBeenCalledWith(CODE);
        expect(view).toMatchObject({ shareLinkId: 'sl1', source: null });
      });

      it('normaliza el código (mayúsculas y espacios) antes de buscar', async () => {
        const { built } = await recorded({ via: '  K7M2Q9XW4T ' }, link());
        expect(built.findByCode).toHaveBeenCalledWith(CODE);
      });

      it('el portal del enlace gana sobre src', async () => {
        const { view } = await recorded({ via: CODE, src: 'indeed' }, link({ portal: 'linkedin' }));
        expect(view).toMatchObject({ shareLinkId: 'sl1', source: 'linkedin' });
      });

      it.each([
        ['revocado', link({ revokedAt: new Date('2026-10-02T00:00:00Z') })],
        ['de otro perfil', link({ curatedProfileId: 'otro' })],
        ['inexistente', null],
      ])('enlace %s: sin atribución, src se conserva', async (_name, found) => {
        const { view } = await recorded({ via: CODE, src: 'Indeed' }, found);
        expect(view).toMatchObject({ shareLinkId: null, source: 'indeed' });
      });

      it.each([['no-existe'], ['k7m2q9xw4'], ['k7m2q9xw4i'], ['']])(
        'código malformado (%j): no consulta el repositorio',
        async (via) => {
          const { built, view } = await recorded({ via }, link());
          expect(built.findByCode).not.toHaveBeenCalled();
          expect(view.shareLinkId).toBeNull();
        },
      );

      it('src inválido se descarta', async () => {
        const { view } = await recorded({ src: 'mi portal' }, null);
        expect(view.source).toBeNull();
      });

      it('responde antes de buscar: con la búsqueda pendiente execute() ya devolvió lo mismo que sin via', async () => {
        const pending = new Promise<ShareLink | null>(() => undefined);
        const withVia = build({ findByCode: jest.fn().mockReturnValue(pending) });
        const without = build();
        const a = await resolveOk(withVia.useCase, {
          viewContext: { locale: 'es', userAgent: 'UA', via: CODE },
        });
        const b = await resolveOk(without.useCase, {
          viewContext: { locale: 'es', userAgent: 'UA' },
        });
        expect(a).toEqual(b);
        expect(withVia.findByCode).not.toHaveBeenCalled(); // recién corre dentro de la tarea
        void withVia.background.flush(); // queda colgada a propósito
        await Promise.resolve();
        expect(withVia.record).not.toHaveBeenCalled();
      });

      it('si la búsqueda falla: registra sin enlace, con src, y el aviso no lleva el código', async () => {
        const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
        try {
          const built = build({
            findByCode: jest.fn().mockRejectedValue(new Error(`${CODE}: base caída`)),
          });
          await resolveOk(built.useCase, {
            viewContext: { locale: 'es', userAgent: 'UA', via: CODE, src: 'indeed' },
          });
          await expect(built.background.flush()).resolves.toBeUndefined();
          expect(built.record).toHaveBeenCalledWith(
            expect.objectContaining({ shareLinkId: null, source: 'indeed' }),
          );
          expect(warn).toHaveBeenCalledTimes(1);
          expect(String(warn.mock.calls[0][0])).not.toContain(CODE);
        } finally {
          warn.mockRestore();
        }
      });

      it('sin viewContext no busca ningún enlace', async () => {
        const built = build();
        await resolveOk(built.useCase);
        await built.background.flush();
        expect(built.findByCode).not.toHaveBeenCalled();
      });
    });
  });
});

// ── Secciones del portafolio (add-portfolio-sections-api) ──
describe('secciones del portafolio', () => {
  it('proyectos: selección por tags con overrides y orden por order', async () => {
    const java = await resolveOk(build().useCase);
    expect(java.projects.map((p) => p.id)).toEqual(['proj-erp']);

    const none = await resolveOk(build({ curated: curated({ filterTags: ['devops'] }) }).useCase);
    expect(none.projects).toEqual([]);

    const all = await resolveOk(build({ curated: curated({ filterTags: [] }) }).useCase);
    expect(all.projects.map((p) => p.id)).toEqual(['proj-web', 'proj-erp']);

    const excluded = await resolveOk(
      build({ curated: curated({ excludeIds: ['proj-erp'], includeIds: ['proj-web'] }) }).useCase,
    );
    expect(excluded.projects.map((p) => p.id)).toEqual(['proj-web']);
  });

  it('educación, certificaciones y social links completos y resueltos al locale', async () => {
    const out = await resolveOk(build().useCase, { locale: 'en' });
    expect(out.education).toEqual([
      {
        id: 'edu-1',
        degree: 'PhD',
        institution: 'UAGRM',
        startDate: '2024-02',
        endDate: null,
        inProgress: true,
        order: 0,
      },
    ]);
    expect(out.certifications[0]).toMatchObject({ id: 'cert-1', name: 'Scrum', year: '2021' });
    expect(out.socialLinks[0]).toMatchObject({
      platform: 'github',
      label: 'Code',
      stats: { repos: 67 },
    });
    expect(out.projects[0].role).toBe('Lead');
    expect(JSON.stringify(out)).not.toMatch(/"es":/);
  });
});

// ── PreviewCuratedProfileUseCase (spec `admin-curated-profile-preview`) ──────
describe('PreviewCuratedProfileUseCase', () => {
  /** Borrador equivalente al perfil de las fixtures, sin id ni vistas. */
  function draft(overrides: Partial<NewCuratedProfileProps> = {}): NewCuratedProfileProps {
    const { id: _id, views: _views, ...props } = curated().toProps();
    return { ...props, ...overrides };
  }

  it('resuelve el borrador con la misma selección que la ruta pública', async () => {
    const { composer, useCase, curatedRepo } = build();
    const preview = await new PreviewCuratedProfileUseCase(composer).execute({
      draft: draft(),
      locale: 'es',
    });
    const publico = await resolveOk(useCase);

    expect(preview.value.experiences.map((e) => e.id)).toEqual(['novacomp', 'vidoomy']);
    // el informe de faltantes es lo único que el preview añade a la vista pública
    const { missingTranslations, ...vista } = preview.value;
    expect(Array.isArray(missingTranslations)).toBe(true);
    expect(vista).toEqual(publico);
    expect(publico).not.toHaveProperty('missingTranslations');
    // el preview no necesitó buscar el perfil por slug
    expect(curatedRepo.findBySlugOrAlias).toHaveBeenCalledTimes(1); // solo la ruta pública
  });

  it('aplica includeIds y excludeIds del borrador', async () => {
    const { composer } = build();
    const result = await new PreviewCuratedProfileUseCase(composer).execute({
      draft: draft({ filterTags: ['java'], excludeIds: ['vidoomy'], includeIds: ['ypfb'] }),
      locale: 'es',
    });
    const ids = result.value.experiences.map((e) => e.id);
    expect(ids).not.toContain('vidoomy');
    expect(ids).toContain('ypfb');
  });

  it('no registra visitas ni escribe en el repositorio de perfiles', async () => {
    const { composer, record, curatedRepo } = build();
    await new PreviewCuratedProfileUseCase(composer).execute({ draft: draft(), locale: 'es' });

    expect(record).not.toHaveBeenCalled();
    expect(curatedRepo.create).not.toHaveBeenCalled();
    expect(curatedRepo.update).not.toHaveBeenCalled();
  });

  it('resuelve borradores PRIVATE y PROTECTED sin exigir token', async () => {
    const { composer } = build();
    const preview = new PreviewCuratedProfileUseCase(composer);

    const privado = await preview.execute({
      draft: draft({ visibility: 'PRIVATE' }),
      locale: 'es',
    });
    const protegido = await preview.execute({
      draft: draft({ visibility: 'PROTECTED', accessToken: AccessToken.create('secreto') }),
      locale: 'es',
    });

    expect(privado.value.experiences).toHaveLength(2);
    expect(protegido.value.experiences).toHaveLength(2);
  });

  it('aplica el tema del borrador con sus overrides', async () => {
    const { composer } = build();
    const result = await new PreviewCuratedProfileUseCase(composer).execute({
      draft: draft({ themeId: 't-el', themeOverrides: { colors: { accent: '#ff0000' } } }),
      locale: 'es',
    });
    expect(result.value.theme?.slug).toBe('elegant');
    expect((result.value.theme?.tokens.colors as Record<string, string>).accent).toBe('#ff0000');
  });

  it('resuelve al locale pedido', async () => {
    const { composer } = build();
    const result = await new PreviewCuratedProfileUseCase(composer).execute({
      draft: draft(),
      locale: 'en',
    });
    expect(result.value.title).toBe('Senior Java');
  });
});

// ── ListCuratedProfilesUseCase ───────────────────────────────────────────────
describe('ListCuratedProfilesUseCase', () => {
  it('lista solo públicos, en orden de entrada, resueltos al locale y sin campos internos', async () => {
    const repo: CuratedProfileRepository = {
      ...stubs(),
      existsBySlug: jest.fn(),
      findBySlug: jest.fn(),
      findBySlugOrAlias: jest.fn(),
      findAllPublic: jest
        .fn()
        .mockResolvedValue([
          curated({ slug: 'b', title: { es: 'B-es', en: 'B-en' } }),
          curated({ slug: 'priv', visibility: 'PRIVATE' }),
          curated({ slug: 'a', title: { es: 'A-es', en: 'A-en' } }),
        ]),
    };
    const result = await new ListCuratedProfilesUseCase(repo).execute({ locale: 'en' });
    expect(result.value.map((p) => p.slug)).toEqual(['b', 'a']);
    expect(result.value[0].title).toBe('B-en');
    expect(result.value[0]).not.toHaveProperty('filterTags');
    expect(result.value[0]).not.toHaveProperty('visibility');
  });
});

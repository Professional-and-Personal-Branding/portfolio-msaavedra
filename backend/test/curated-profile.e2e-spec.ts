/**
 * E2E — perfiles curados (specs curated-profile-resolution, theme-resolution,
 * public-curated-profile-api). Requiere Postgres arriba y la base migrada + seedeada.
 * Las expectativas se derivan de docs/cv-data.json aplicando la misma regla de
 * intersección de tags (independiente de la implementación).
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import { GLOBAL_PREFIX } from '../src/app.constants';
import { AppModule } from '../src/app.module';
import { buildCorsOptions } from '../src/shared/infrastructure/http/cors.options';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';
import { setupSwagger } from '../src/swagger';

interface Localized {
  es: string;
  en: string;
}
interface CvData {
  experiences: { id: string; company: string; tags: string[]; startDate: string }[];
  skillCategories: { name: Localized; skills: string[] }[];
  profileTemplates: {
    slug: string;
    title: Localized;
    roleType?: Localized;
    filterTags: string[];
    themeOverrides?: { colors?: { accent?: string } };
  }[];
}

const intersects = (a: string[], b: string[]) => b.length === 0 || a.some((t) => b.includes(t));

function hasLocalizedObject(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasLocalizedObject);
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value);
    if (keys.includes('es') || keys.includes('en')) return true;
    return Object.values(value as Record<string, unknown>).some(hasLocalizedObject);
  }
  return false;
}

describe('Perfiles curados (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cv: CvData;

  const get = (url: string) => request(app.getHttpServer()).get(url);
  const template = (slug: string) => {
    const t = cv.profileTemplates.find((p) => p.slug === slug);
    if (!t) throw new Error(`plantilla ${slug} no está en cv-data.json`);
    return t;
  };
  const expectedCompanies = (filterTags: string[]) =>
    cv.experiences.filter((e) => intersects(e.tags, filterTags)).map((e) => e.company);

  beforeAll(async () => {
    cv = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../docs/cv-data.json'), 'utf-8'),
    ) as CvData;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(GLOBAL_PREFIX);
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.enableCors(buildCorsOptions('http://localhost:5173'));
    setupSwagger(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Listado ────────────────────────────────────────────────────────────
  describe('GET /api/curated-profiles', () => {
    it('lista los públicos en orden de creación, con "all" al final', async () => {
      const res = await get('/api/curated-profiles');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(cv.profileTemplates.length + 1);
      expect(res.body[res.body.length - 1].slug).toBe('all');
      expect(res.headers['content-language']).toBe('es');
      for (const item of res.body as Record<string, unknown>[]) {
        expect(Object.keys(item).sort()).toEqual(
          ['slug', 'title', 'headline', 'description', 'roleType', 'techFocus', 'layout'].sort(),
        );
      }
    });

    it('el perfil base del perfil curado trae el nivel de los idiomas en el idioma pedido', async () => {
      for (const slug of ['all', 'tech-lead-dotnet']) {
        const en = await get(`/api/curated-profiles/${slug}?lang=en`);
        const es = await get(`/api/curated-profiles/${slug}?lang=es`);
        const viaLocale = await get(`/api/curated-profiles/${slug}?locale=en`);
        expect(en.body.profile.languages[0].name).toBe('Spanish');
        expect(en.body.profile.languages[0].level).toBe('Native');
        expect(es.body.profile.languages[0].level).toBe('Nativo');
        expect(viaLocale.body.profile.languages[0].level).toBe('Native');
      }
    });

    it('en inglés resuelve title y roleType', async () => {
      const res = await get('/api/curated-profiles?locale=en');
      const item = (res.body as { slug: string; title: string; roleType: string }[]).find(
        (p) => p.slug === 'tech-lead-dotnet',
      );
      expect(item?.title).toBe(template('tech-lead-dotnet').title.en);
      expect(item?.roleType).toBe(template('tech-lead-dotnet').roleType?.en);
      expect(hasLocalizedObject(res.body)).toBe(false);
    });
  });

  // ─── Detalle: selección por tags ────────────────────────────────────────
  describe('GET /api/curated-profiles/:slug — selección', () => {
    it('tech-lead-dotnet: cada experiencia intersecta; eron-directa24 y kiwox no aparecen', async () => {
      const { filterTags } = template('tech-lead-dotnet');
      const res = await get('/api/curated-profiles/tech-lead-dotnet?locale=es');
      expect(res.status).toBe(200);
      expect(res.body.slug).toBe('tech-lead-dotnet');
      const companies = (res.body.experiences as { company: string; tags: string[] }[]).map(
        (e) => e.company,
      );
      expect(companies.sort()).toEqual(expectedCompanies(filterTags).sort());
      for (const e of res.body.experiences as { tags: string[] }[]) {
        expect(intersects(e.tags, filterTags)).toBe(true);
      }
      const excluded = cv.experiences
        .filter((e) => ['eron-directa24', 'kiwox'].includes(e.id))
        .map((e) => e.company);
      for (const c of excluded) expect(companies).not.toContain(c);
      expect(res.body.theme.slug).toBe('modern-dark');
    });

    it('java-senior-backend no trae experiencias .NET puras (ypfb, delta-cargo)', async () => {
      const { filterTags } = template('java-senior-backend');
      const res = await get('/api/curated-profiles/java-senior-backend');
      const companies = (res.body.experiences as { company: string }[]).map((e) => e.company);
      expect(companies.sort()).toEqual(expectedCompanies(filterTags).sort());
      const dotnetOnly = cv.experiences
        .filter((e) => ['ypfb', 'delta-cargo'].includes(e.id))
        .map((e) => e.company);
      for (const c of dotnetOnly) expect(companies).not.toContain(c);
    });

    it('generalist-polyglot resuelve la mayoría (todas las visibles)', async () => {
      const res = await get('/api/curated-profiles/generalist-polyglot');
      expect(res.body.experiences).toHaveLength(cv.experiences.length);
    });

    it('all (filterTags vacío) trae todo: 15 experiencias, 12 categorías, 108 skills', async () => {
      const res = await get('/api/curated-profiles/all');
      expect(res.body.experiences).toHaveLength(cv.experiences.length);
      expect(res.body.skillCategories).toHaveLength(cv.skillCategories.length);
      const total = (res.body.skillCategories as { skills: string[] }[]).reduce(
        (n, c) => n + c.skills.length,
        0,
      );
      expect(total).toBe(cv.skillCategories.reduce((n, c) => n + c.skills.length, 0));
    });

    it('skills: categorías vacías no aparecen (devops-platform trae un subconjunto)', async () => {
      const res = await get('/api/curated-profiles/devops-platform');
      const cats = res.body.skillCategories as { name: string; skills: string[] }[];
      expect(cats.length).toBeGreaterThan(0);
      expect(cats.length).toBeLessThan(cv.skillCategories.length);
      for (const c of cats) expect(c.skills.length).toBeGreaterThan(0);
    });

    it('orden cronológico descendente', async () => {
      const res = await get('/api/curated-profiles/generalist-polyglot');
      const items = res.body.experiences as { startDate: string }[];
      for (let i = 1; i < items.length; i++) {
        expect(items[i - 1].startDate >= items[i].startDate).toBe(true);
      }
    });
  });

  // ─── Detalle: forma, locale, tema, secciones ────────────────────────────
  describe('GET /api/curated-profiles/:slug — forma y locale', () => {
    it('forma completa, sin campos sensibles ni objetos localizados', async () => {
      const res = await get('/api/curated-profiles/tech-lead-dotnet');
      expect(Object.keys(res.body).sort()).toEqual(
        [
          'slug',
          'title',
          'headline',
          'description',
          'roleType',
          'techFocus',
          'layout',
          'visibility',
          'updatedAt',
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
      for (const key of ['accessToken', 'includeIds', 'excludeIds', 'filterTags']) {
        expect(res.body).not.toHaveProperty(key);
      }
      expect(hasLocalizedObject(res.body)).toBe(false);
      expect(Object.keys(res.body.theme).sort()).toEqual(
        ['slug', 'name', 'isPreset', 'tokens'].sort(),
      );
      // unify-section-catalog: el orden final ya incluye projects y presence en su lugar.
      expect(res.body.sections).toEqual([
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
      expect(res.body.hiddenSections).toEqual([]);
      expect(res.body.profile.fullName).toBeDefined();
    });

    it('el acento migrado llega a theme.tokens.colors.accent y la respuesta no trae accentColor', async () => {
      // retire-accent-color: el valor sale de cv-data.json (la base se migró desde accentColor
      // o se sembró con la misma forma; D3/D11).
      for (const slug of ['fullstack-nest-react', 'tech-lead-dotnet']) {
        const res = await get('/api/curated-profiles/' + slug);
        const expected = template(slug).themeOverrides?.colors?.accent;
        expect(expected).toBeDefined();
        expect(res.body.theme.tokens.colors.accent).toBe(expected);
        expect(res.body).not.toHaveProperty('accentColor');
      }
      const all = await get('/api/curated-profiles/all');
      expect(all.body.theme.tokens.colors.accent).toBe('#38bdf8');
    });

    it('locale en aplica a todo el árbol', async () => {
      const res = await get('/api/curated-profiles/tech-lead-dotnet?locale=en');
      expect(res.headers['content-language']).toBe('en');
      expect(res.body.title).toBe(template('tech-lead-dotnet').title.en);
      expect(res.body.roleType).toBe('Tech Lead');
      expect(res.body.skillCategories[0].name).toBe(cv.skillCategories[0].name.en);
    });

    it('locale inexistente cae al español', async () => {
      const res = await get('/api/curated-profiles/all?locale=xx');
      expect(res.status).toBe(200);
      expect(res.headers['content-language']).toBe('es');
      expect(res.body.title).toBe('Perfil Completo');
    });

    it('themeOverrides se mergean sobre el tema base (mutación revertida)', async () => {
      const row = await prisma.curatedProfile.findUniqueOrThrow({ where: { slug: 'all' } });
      await prisma.curatedProfile.update({
        where: { id: row.id },
        data: { themeOverrides: { colors: { accent: '#123456' }, mode: 'light' } },
      });
      try {
        const res = await get('/api/curated-profiles/all');
        expect(res.body.theme.tokens.colors.accent).toBe('#123456');
        expect(res.body.theme.tokens.colors.bg).toBe('#0a0e1a');
        expect(res.body.theme.tokens.mode).toBe('light');
      } finally {
        await prisma.curatedProfile.update({
          where: { id: row.id },
          // `undefined` en Prisma es "no tocar": un original nulo se repone con DbNull.
          data: { themeOverrides: row.themeOverrides ?? Prisma.DbNull },
        });
      }
    });
  });

  // ─── Overrides de ids (mutación revertida) ──────────────────────────────
  describe('overrides includeIds / excludeIds', () => {
    it('excludeIds saca una experiencia que matchea; includeIds mete una que no', async () => {
      const row = await prisma.curatedProfile.findUniqueOrThrow({
        where: { slug: 'tech-lead-dotnet' },
      });
      const novacomp = await prisma.experience.findFirstOrThrow({ where: { company: 'Novacomp' } });
      const kiwoxCompany = cv.experiences.find((e) => e.id === 'kiwox')?.company ?? '';
      const kiwox = await prisma.experience.findFirstOrThrow({ where: { company: kiwoxCompany } });
      await prisma.curatedProfile.update({
        where: { id: row.id },
        data: { excludeIds: [novacomp.id], includeIds: [kiwox.id] },
      });
      try {
        const res = await get('/api/curated-profiles/tech-lead-dotnet');
        const ids = (res.body.experiences as { id: string }[]).map((e) => e.id);
        expect(ids).not.toContain(novacomp.id);
        expect(ids).toContain(kiwox.id);
      } finally {
        await prisma.curatedProfile.update({
          where: { id: row.id },
          data: { excludeIds: row.excludeIds, includeIds: row.includeIds },
        });
      }
    });
  });

  // ─── Visibilidad y acceso (mutación revertida) ──────────────────────────
  describe('visibilidad', () => {
    it('slug inexistente → 404', async () => {
      const res = await get('/api/curated-profiles/no-existe');
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ statusCode: 404, error: 'Not Found' });
    });

    it('PRIVATE → 404 y fuera del listado', async () => {
      const row = await prisma.curatedProfile.findUniqueOrThrow({
        where: { slug: 'it-leadership' },
      });
      await prisma.curatedProfile.update({
        where: { id: row.id },
        data: { visibility: 'PRIVATE' },
      });
      try {
        expect((await get('/api/curated-profiles/it-leadership')).status).toBe(404);
        const list = await get('/api/curated-profiles');
        expect((list.body as { slug: string }[]).some((p) => p.slug === 'it-leadership')).toBe(
          false,
        );
      } finally {
        await prisma.curatedProfile.update({
          where: { id: row.id },
          data: { visibility: row.visibility },
        });
      }
    });

    it('PROTECTED: 401 sin token o token incorrecto; 200 por header o query', async () => {
      const row = await prisma.curatedProfile.findUniqueOrThrow({
        where: { slug: 'dotnet-backend' },
      });
      await prisma.curatedProfile.update({
        where: { id: row.id },
        data: { visibility: 'PROTECTED', accessToken: 'tok-e2e-123' },
      });
      try {
        const sin = await get('/api/curated-profiles/dotnet-backend');
        expect(sin.status).toBe(401);
        expect(sin.body).toMatchObject({ statusCode: 401, error: 'Unauthorized' });

        const mal = await get('/api/curated-profiles/dotnet-backend').set('X-Access-Token', 'otro');
        expect(mal.status).toBe(401);

        const header = await get('/api/curated-profiles/dotnet-backend').set(
          'X-Access-Token',
          'tok-e2e-123',
        );
        expect(header.status).toBe(200);
        expect(header.body.visibility).toBe('PROTECTED');
        expect(JSON.stringify(header.body)).not.toContain('tok-e2e-123');

        const query = await get('/api/curated-profiles/dotnet-backend?token=tok-e2e-123');
        expect(query.status).toBe(200);

        const list = await get('/api/curated-profiles');
        expect((list.body as { slug: string }[]).some((p) => p.slug === 'dotnet-backend')).toBe(
          false,
        );
      } finally {
        await prisma.curatedProfile.update({
          where: { id: row.id },
          data: { visibility: row.visibility, accessToken: row.accessToken },
        });
      }
    });
  });

  // ─── OpenAPI ────────────────────────────────────────────────────────────
  it('OpenAPI documenta ambas rutas y sus parámetros', async () => {
    const res = await get('/api/docs-json');
    const paths = res.body.paths as Record<
      string,
      { get: { parameters?: { name: string; in: string }[] } }
    >;
    expect(paths).toHaveProperty('/api/curated-profiles');
    expect(paths).toHaveProperty('/api/curated-profiles/{slug}');
    const params = paths['/api/curated-profiles/{slug}'].get.parameters ?? [];
    const names = params.map((p) => `${p.in}:${p.name}`);
    expect(names).toEqual(
      expect.arrayContaining(['query:locale', 'query:token', 'header:X-Access-Token', 'path:slug']),
    );
  });
});

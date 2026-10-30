/**
 * E2E — specs `admin-curated-profile-preview` y `admin-theme-catalog`
 * (change `add-admin-backoffice`). Requiere Postgres arriba y la base
 * migrada + seedeada.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';
import {
  createE2eAdmin,
  createTestApp,
  deleteE2eAdmin,
  login,
  loginCookie,
  settleBackgroundTasks,
} from './e2e-helpers';

const SLUG = 'tech-lead-dotnet';

interface AdminProfile {
  id: string;
  slug: string;
  title: unknown;
  headline: unknown;
  description: unknown;
  roleType: unknown;
  techFocus: string | null;
  filterTags: string[];
  includeIds: string[];
  excludeIds: string[];
  themeId: string | null;
  themeOverrides: unknown;
  layout: string;
  sectionsOrder: string[];
  sectionsHidden: string[];
  visibility: string;
  views: number;
}

describe('Backoffice: preview y catálogo de temas (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let cookie: string;

  const get = (url: string) => request(app.getHttpServer()).get(url);
  const post = (url: string) => request(app.getHttpServer()).post(url);
  const preview = () =>
    post('/api/admin/curated-profiles/preview').set('Authorization', `Bearer ${token}`);

  /**
   * Borrador equivalente a un perfil guardado: solo los campos que acepta el
   * DTO de preview (el cuerpo admin trae además id, views y marcas de tiempo).
   */
  function draftOf(profile: AdminProfile): Record<string, unknown> {
    return {
      slug: profile.slug,
      title: profile.title,
      headline: profile.headline,
      description: profile.description,
      roleType: profile.roleType,
      techFocus: profile.techFocus,
      filterTags: profile.filterTags,
      includeIds: profile.includeIds,
      excludeIds: profile.excludeIds,
      themeId: profile.themeId,
      themeOverrides: profile.themeOverrides,
      layout: profile.layout,
      sectionsOrder: profile.sectionsOrder,
      sectionsHidden: profile.sectionsHidden,
      visibility: profile.visibility,
    };
  }

  async function adminProfile(slug = SLUG): Promise<AdminProfile> {
    const res = await get('/api/admin/curated-profiles').set('Authorization', `Bearer ${token}`);
    const found = (res.body as AdminProfile[]).find((p) => p.slug === slug);
    if (!found) throw new Error(`no existe el perfil ${slug} en la base de pruebas`);
    return found;
  }

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await createE2eAdmin(prisma);
    token = await login(app);
    cookie = await loginCookie(app);
  });

  afterAll(async () => {
    await deleteE2eAdmin(prisma);
    await app.close();
  });

  describe('POST /api/admin/curated-profiles/preview', () => {
    it('sin sesión → 401', async () => {
      const res = await post('/api/admin/curated-profiles/preview').send({ filterTags: ['java'] });
      expect(res.status).toBe(401);
    });

    it('un borrador con accentColor → 400 nombrando la propiedad (retire-accent-color, D2)', async () => {
      const res = await preview().send({ filterTags: ['dotnet'], accentColor: '#5B2C87' });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('accentColor');
    });

    it('con la cookie de sesión también autentica', async () => {
      const res = await post('/api/admin/curated-profiles/preview')
        .set('Cookie', cookie)
        .send({ filterTags: ['dotnet'] });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.experiences)).toBe(true);
    });

    it('resuelve un borrador nuevo sin crear ningún perfil', async () => {
      const before = await prisma.curatedProfile.count();
      const res = await preview().send({
        slug: 'borrador-e2e',
        title: { es: 'Borrador', en: 'Draft' },
        filterTags: ['dotnet'],
      });
      const after = await prisma.curatedProfile.count();

      expect(res.status).toBe(200);
      expect(after).toBe(before);
      expect(
        await prisma.curatedProfile.findUnique({ where: { slug: 'borrador-e2e' } }),
      ).toBeNull();
      expect(res.body.experiences.length).toBeGreaterThan(0);
      expect(res.body.theme).not.toBeNull();
      expect(Array.isArray(res.body.sections)).toBe(true);
    });

    it('devuelve exactamente lo mismo que la ruta pública para los mismos criterios', async () => {
      const profile = await adminProfile();
      const publico = await get(`/api/curated-profiles/${SLUG}?locale=es`);
      const previewed = await preview().query({ locale: 'es' }).send(draftOf(profile));

      expect(publico.status).toBe(200);
      expect(previewed.status).toBe(200);
      // todo igual salvo el informe de faltantes, que solo existe en el preview
      const { missingTranslations, ...vista } = previewed.body;
      expect(Array.isArray(missingTranslations)).toBe(true);
      expect(vista).toEqual(publico.body);
      expect(publico.body).not.toHaveProperty('missingTranslations');
    });

    describe('missingTranslations (add-bilingual-builder-parity)', () => {
      const missing = (body: { missingTranslations: { id: string; field: string }[] }) =>
        body.missingTranslations;
      let expId: string;

      beforeAll(async () => {
        const created = await prisma.experience.create({
          data: {
            company: 'E2E Faltantes',
            role: { es: 'Rol e2e', en: 'E2E role' },
            startDate: '2099-01',
            location: 'Remoto',
            summary: { es: 'Resumen', en: 'Summary' },
            highlights: { es: ['Logro en español'], en: [] },
            technologies: [],
            tags: ['e2e-faltantes'],
            sector: [],
          },
        });
        expId = created.id;
      });

      afterAll(async () => {
        await prisma.experience.delete({ where: { id: expId } });
      });

      it('el preview en EN lista la experiencia sin highlights.en; en ES no', async () => {
        const draft = { filterTags: ['e2e-faltantes'] };
        const en = await preview().query({ locale: 'en' }).send(draft);
        const es = await preview().query({ locale: 'es' }).send(draft);

        expect(en.status).toBe(200);
        expect(Array.isArray(en.body.missingTranslations)).toBe(true);
        expect(missing(en.body)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ entity: 'experience', id: expId, field: 'highlights' }),
          ]),
        );
        expect(missing(es.body).filter((m) => m.id === expId)).toEqual([]);
      });

      it('un idioma con el nivel sin inglés aparece como entidad language; la ruta pública no', async () => {
        const lang = await prisma.language.create({
          data: {
            name: 'E2E Faltantes',
            nameI18n: { es: 'E2E', en: 'E2E' },
            level: { es: 'Intermedio' },
            profile: { connect: { id: (await prisma.profile.findFirstOrThrow()).id } },
          },
        });
        try {
          const draft = { filterTags: ['e2e-faltantes'] };
          const en = await preview().query({ locale: 'en' }).send(draft);
          const es = await preview().query({ locale: 'es' }).send(draft);
          expect(en.status).toBe(200);
          expect(missing(en.body)).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ entity: 'language', id: lang.id, field: 'level' }),
            ]),
          );
          expect(missing(es.body).filter((m) => m.id === lang.id)).toEqual([]);
          const pub = await get(`/api/curated-profiles/${SLUG}?locale=en`);
          expect(pub.body).not.toHaveProperty('missingTranslations');
        } finally {
          await prisma.language.delete({ where: { id: lang.id } });
        }
      });

      it('el seed no deja idiomas con faltantes en EN', async () => {
        const en = await preview()
          .query({ locale: 'en' })
          .send({ filterTags: ['java'] });
        expect(
          (en.body.missingTranslations as { entity: string }[]).filter(
            (m) => m.entity === 'language',
          ),
        ).toEqual([]);
      });

      it('la ruta pública no trae el informe', async () => {
        const res = await get(`/api/curated-profiles/${SLUG}?locale=en`);
        expect(res.status).toBe(200);
        expect(res.body).not.toHaveProperty('missingTranslations');
      });
    });

    it('no registra visitas ni mueve el contador del perfil', async () => {
      // El test anterior abre la ruta pública: su visita se guarda en segundo plano y,
      // si no se espera, entra después de tomar la línea base y suma uno al contador.
      await settleBackgroundTasks(app);
      const profile = await adminProfile();
      const viewsBefore = await prisma.profileView.count({
        where: { curatedProfileId: profile.id },
      });

      await preview().send(draftOf(profile));
      await settleBackgroundTasks(app);

      const row = await prisma.curatedProfile.findUniqueOrThrow({ where: { id: profile.id } });
      const viewsAfter = await prisma.profileView.count({
        where: { curatedProfileId: profile.id },
      });
      expect(row.views).toBe(profile.views);
      expect(viewsAfter).toBe(viewsBefore);
    });

    it('aplica includeIds y excludeIds del borrador', async () => {
      const base = await preview().send({ filterTags: ['java'] });
      const ids = (base.body.experiences as { id: string }[]).map((e) => e.id);
      expect(ids.length).toBeGreaterThan(1);

      const excluded = ids[0];
      const res = await preview().send({ filterTags: ['java'], excludeIds: [excluded] });
      const after = (res.body.experiences as { id: string }[]).map((e) => e.id);
      expect(after).not.toContain(excluded);
      expect(after).toHaveLength(ids.length - 1);
    });

    // Change add-builder-skill-project-overrides (D11): el constructor escribe ids de skills y
    // proyectos en los mismos arreglos; el preview y la ruta pública deben resolverlos igual.
    it('Overrides de skills y proyectos: el preview y la ruta pública coinciden tras guardar', async () => {
      const slug = 'e2e-overrides-ovr';
      const auth = { Authorization: `Bearer ${token}` };
      // Fixtures propios: una categoría con una skill java y otra sin tags comunes, y un proyecto
      // visible sin tags comunes.
      const category = await prisma.skillCategory.create({
        data: {
          name: { es: 'Categoría e2e overrides', en: 'E2E overrides category' },
          order: 9999,
          skills: {
            create: [
              { name: 'E2E Java skill', tags: ['java'], order: 0 },
              { name: 'E2E Libre skill', tags: ['e2e-ovr'], order: 1 },
            ],
          },
        },
        include: { skills: true },
      });
      const excludedSkill = category.skills.find((s) => s.name === 'E2E Java skill');
      const includedSkill = category.skills.find((s) => s.name === 'E2E Libre skill');
      const project = await prisma.project.create({
        data: {
          name: 'E2E Proyecto libre',
          role: { es: 'Autor', en: 'Author' },
          period: '2026',
          summary: { es: 'x', en: 'x' },
          technologies: [],
          tags: ['e2e-ovr'],
          order: 9999,
          visible: true,
        },
      });
      if (!excludedSkill || !includedSkill) throw new Error('fixtures de skills incompletas');
      const criteria = {
        filterTags: ['java'],
        includeIds: [includedSkill.id, project.id],
        excludeIds: [excludedSkill.id],
      };
      try {
        // Sin overrides: la skill java entra por tag y las otras dos no.
        const base = await preview().send({ filterTags: ['java'] });
        expect(JSON.stringify(base.body.skillCategories)).toContain('E2E Java skill');
        expect(JSON.stringify(base.body.skillCategories)).not.toContain('E2E Libre skill');
        expect((base.body.projects as { id: string }[]).map((p) => p.id)).not.toContain(project.id);

        const res = await preview().send(criteria);
        expect(res.status).toBe(200);
        const categories = res.body.skillCategories as { name: string; skills: string[] }[];
        const mine = categories.find((c) => c.name === 'Categoría e2e overrides');
        expect(mine?.skills).toEqual(['E2E Libre skill']);
        expect((res.body.projects as { id: string }[]).map((p) => p.id)).toContain(project.id);

        // Guardar los mismos criterios en un perfil de prueba y comparar con la ruta pública.
        const created = await request(app.getHttpServer())
          .post('/api/admin/curated-profiles')
          .set(auth)
          .send({ slug, title: { es: 'Overrides e2e', en: 'Overrides e2e' } });
        expect(created.status).toBe(201);
        const patched = await request(app.getHttpServer())
          .patch(`/api/admin/curated-profiles/${created.body.id as string}`)
          .set(auth)
          .send(criteria);
        expect(patched.status).toBe(200);

        const publico = await get(`/api/curated-profiles/${slug}?locale=es`);
        expect(publico.status).toBe(200);
        const saved = await adminProfile(slug);
        expect(saved.includeIds).toEqual(criteria.includeIds);
        expect(saved.excludeIds).toEqual(criteria.excludeIds);
        const previewed = await preview()
          .query({ locale: 'es' })
          .send({ slug, title: { es: 'Overrides e2e', en: 'Overrides e2e' }, ...criteria });
        expect(previewed.status).toBe(200);
        expect(publico.body.experiences).toEqual(previewed.body.experiences);
        expect(publico.body.skillCategories).toEqual(previewed.body.skillCategories);
        expect(publico.body.projects).toEqual(previewed.body.projects);
        expect(publico.body.skillCategories).toEqual(res.body.skillCategories);
        expect(publico.body.projects).toEqual(res.body.projects);
      } finally {
        await settleBackgroundTasks(app);
        await prisma.curatedProfile.deleteMany({ where: { slug } });
        await prisma.skillCategory.delete({ where: { id: category.id } });
        await prisma.project.delete({ where: { id: project.id } });
      }
    });

    it('un borrador PRIVATE o PROTECTED se resuelve sin token de acceso', async () => {
      const privado = await preview().send({ filterTags: ['java'], visibility: 'PRIVATE' });
      const protegido = await preview().send({
        filterTags: ['java'],
        visibility: 'PROTECTED',
        accessToken: 'secreto-e2e',
      });

      expect(privado.status).toBe(200);
      expect(protegido.status).toBe(200);
      expect(privado.body.experiences.length).toBeGreaterThan(0);
      expect(protegido.body.experiences.length).toBeGreaterThan(0);
      // el token del borrador nunca se filtra en la respuesta pública
      expect(JSON.stringify(protegido.body)).not.toContain('secreto-e2e');
    });

    it('respeta el locale negociado y rechaza un cuerpo inválido', async () => {
      const en = await preview()
        .query({ locale: 'en' })
        .send({ filterTags: ['dotnet'] });
      expect(en.status).toBe(200);
      expect(en.headers['content-language']).toBe('en');

      const bad = await preview().send({ slug: 'No Es Kebab Case' });
      expect(bad.status).toBe(400);
    });
  });

  describe('GET /api/admin/themes', () => {
    it('sin sesión → 401', async () => {
      expect((await get('/api/admin/themes')).status).toBe(401);
    });

    it('devuelve los 5 presets del seed con id y tokens', async () => {
      const res = await get('/api/admin/themes').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);

      const slugs = (res.body as { slug: string }[]).map((t) => t.slug);
      expect(slugs).toEqual(
        expect.arrayContaining(['modern-dark', 'modern-light', 'minimal', 'elegant', 'corporate']),
      );

      const dark = (
        res.body as { slug: string; id: string; isPreset: boolean; tokens: unknown }[]
      ).find((t) => t.slug === 'modern-dark');
      expect(dark?.isPreset).toBe(true);
      expect(typeof dark?.id).toBe('string');
      expect(dark?.tokens).toMatchObject({ mode: 'dark' });
    });

    it('el id del catálogo sirve como themeId en el preview', async () => {
      const themes = await get('/api/admin/themes').set('Authorization', `Bearer ${token}`);
      const elegant = (themes.body as { slug: string; id: string }[]).find(
        (t) => t.slug === 'elegant',
      );

      const res = await preview().send({ filterTags: ['java'], themeId: elegant?.id });
      expect(res.status).toBe(200);
      expect(res.body.theme.slug).toBe('elegant');
    });
  });
});

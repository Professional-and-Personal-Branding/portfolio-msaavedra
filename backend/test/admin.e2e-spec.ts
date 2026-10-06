/**
 * E2E — specs `admin-experience-crud`, `admin-skill-crud`, `admin-curated-profile-crud`,
 * `profile-view-analytics`. Todo lo creado se borra y las mutaciones se revierten.
 */
import { INestApplication } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';
import {
  cleanupE2eLeftovers,
  createE2eAdmin,
  createTestApp,
  deleteE2eAdmin,
  login,
} from './e2e-helpers';

interface CvData {
  experiences: { id: string; company: string }[];
  profileTemplates: { slug: string; filterTags: string[] }[];
}

describe('Backoffice (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let cv: CvData;

  const server = () => app.getHttpServer();
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
  const get = (url: string) => request(server()).get(url);
  const adminGet = (url: string) => auth(request(server()).get(url));
  const adminPost = (url: string) => auth(request(server()).post(url));
  const adminPatch = (url: string) => auth(request(server()).patch(url));
  const adminDelete = (url: string) => auth(request(server()).delete(url));
  const companyOf = (id: string) => cv.experiences.find((e) => e.id === id)?.company ?? '';

  beforeAll(async () => {
    cv = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../docs/cv-data.json'), 'utf-8'),
    ) as CvData;
    ({ app, prisma } = await createTestApp());
    await cleanupE2eLeftovers(prisma);
    await createE2eAdmin(prisma);
    token = await login(app);
  });

  afterAll(async () => {
    await deleteE2eAdmin(prisma);
    await app.close();
  });

  // ─── Experiencias ───────────────────────────────────────────────────────
  describe('CRUD de experiencias', () => {
    const body = {
      company: 'ACME E2E',
      role: { es: 'Dev', en: 'Dev' },
      startDate: '2025-01',
      current: true,
      location: 'Remoto',
      summary: { es: 'Resumen', en: 'Summary' },
      highlights: { es: ['logro'], en: ['achievement'] },
      technologies: ['Java'],
      tags: ['java'],
      order: 0,
    };

    it('ciclo completo: crear → visible en público y en perfil curado → patch → ocultar → borrar', async () => {
      const publicBefore = (await get('/api/experiences')).body.length as number;
      const created = await adminPost('/api/admin/experiences').send(body);
      expect(created.status).toBe(201);
      const id = created.body.id as string;
      try {
        expect(created.body).toMatchObject({ company: 'ACME E2E', visible: true, tags: ['java'] });
        expect(created.body.role).toEqual({ es: 'Dev', en: 'Dev' });

        const publicAfter = await get('/api/experiences');
        expect(publicAfter.body).toHaveLength(publicBefore + 1);
        const inJava = await get('/api/curated-profiles/java-senior-backend');
        expect((inJava.body.experiences as { id: string }[]).some((e) => e.id === id)).toBe(true);

        const patched = await adminPatch(`/api/admin/experiences/${id}`).send({ tags: ['dotnet'] });
        expect(patched.status).toBe(200);
        expect(patched.body.tags).toEqual(['dotnet']);
        expect(patched.body.company).toBe('ACME E2E');
        const outOfJava = await get('/api/curated-profiles/java-senior-backend');
        expect((outOfJava.body.experiences as { id: string }[]).some((e) => e.id === id)).toBe(
          false,
        );

        const hidden = await adminPatch(`/api/admin/experiences/${id}`).send({ visible: false });
        expect(hidden.body.visible).toBe(false);
        expect((await get('/api/experiences')).body).toHaveLength(publicBefore);
        expect((await get(`/api/experiences/${id}`)).status).toBe(404);

        const adminList = await adminGet('/api/admin/experiences');
        const item = (adminList.body as { id: string; visible: boolean; role: unknown }[]).find(
          (e) => e.id === id,
        );
        expect(item?.visible).toBe(false);
        expect(item?.role).toEqual({ es: 'Dev', en: 'Dev' });
        expect((await adminGet(`/api/admin/experiences/${id}`)).status).toBe(200);
      } finally {
        const del = await adminDelete(`/api/admin/experiences/${id}`);
        expect(del.status).toBe(204);
      }
      expect((await adminGet(`/api/admin/experiences/${id}`)).status).toBe(404);
      expect((await adminDelete(`/api/admin/experiences/${id}`)).status).toBe(404);
      expect((await get('/api/experiences')).body).toHaveLength(publicBefore);
    });

    it('validaciones: fecha inválida, campo desconocido, sin es, current con endDate → 400', async () => {
      const badDate = await adminPost('/api/admin/experiences').send({
        ...body,
        startDate: '2025-13',
      });
      expect(badDate.status).toBe(400);
      expect(JSON.stringify(badDate.body.message)).toContain('startDate');

      const unknown = await adminPost('/api/admin/experiences').send({ ...body, hacker: true });
      expect(unknown.status).toBe(400);

      const noEs = await adminPost('/api/admin/experiences').send({ ...body, role: { en: 'Dev' } });
      expect(noEs.status).toBe(400);

      const rule = await adminPost('/api/admin/experiences').send({ ...body, endDate: '2025-06' });
      expect(rule.status).toBe(400); // current=true con endDate (regla de dominio)
      expect(await prisma.experience.count({ where: { company: 'ACME E2E' } })).toBe(0);
    });

    it('omitir un texto bilingüe obligatorio (role, summary) → 400, no 500 (D-02)', async () => {
      for (const field of ['role', 'summary'] as const) {
        const { [field]: _omitted, ...sinCampo } = body;
        const res = await adminPost('/api/admin/experiences').send(sinCampo);
        expect(res.status).toBe(400);
        expect(JSON.stringify(res.body.message)).toContain(field);
      }
      expect(await prisma.experience.count({ where: { company: 'ACME E2E' } })).toBe(0);
    });

    it('404 en get/patch de id inexistente; referencia huérfana en overrides no rompe', async () => {
      expect((await adminGet('/api/admin/experiences/no-existe')).status).toBe(404);
      expect((await adminPatch('/api/admin/experiences/no-existe').send({ order: 1 })).status).toBe(
        404,
      );

      const profile = await prisma.curatedProfile.findUniqueOrThrow({ where: { slug: 'all' } });
      await prisma.curatedProfile.update({
        where: { id: profile.id },
        data: { excludeIds: ['id-que-ya-no-existe'] },
      });
      try {
        expect((await get('/api/curated-profiles/all')).status).toBe(200);
      } finally {
        await prisma.curatedProfile.update({
          where: { id: profile.id },
          data: { excludeIds: profile.excludeIds },
        });
      }
    });
  });

  // ─── Skills ─────────────────────────────────────────────────────────────
  describe('CRUD de skills', () => {
    it('categoría + skill con tags aparecen en el perfil curado; patch tags; mover; borrar en cascada', async () => {
      const cat = await adminPost('/api/admin/skill-categories').send({
        name: { es: 'Datos E2E', en: 'Data E2E' },
        order: 99,
      });
      expect(cat.status).toBe(201);
      const categoryId = cat.body.id as string;
      try {
        expect(cat.body.skills).toEqual([]);

        const skill = await adminPost(`/api/admin/skill-categories/${categoryId}/skills`).send({
          name: 'Kafka Streams E2E',
          tags: ['java', 'messaging'],
        });
        expect(skill.status).toBe(201);
        const skillId = skill.body.id as string;
        expect(skill.body.categoryId).toBe(categoryId);

        const inJava = await get('/api/curated-profiles/java-senior-backend');
        const catInJava = (
          inJava.body.skillCategories as { name: string; skills: string[] }[]
        ).find((c) => c.name === 'Datos E2E');
        expect(catInJava?.skills).toContain('Kafka Streams E2E');

        const retagged = await adminPatch(`/api/admin/skills/${skillId}`).send({ tags: ['ruby'] });
        expect(retagged.status).toBe(200);
        const outOfJava = await get('/api/curated-profiles/java-senior-backend');
        expect(
          (outOfJava.body.skillCategories as { name: string }[]).some(
            (c) => c.name === 'Datos E2E',
          ),
        ).toBe(false);

        const list = await adminGet('/api/admin/skill-categories');
        const other = (list.body as { id: string }[]).find((c) => c.id !== categoryId)!;
        const moved = await adminPatch(`/api/admin/skills/${skillId}`).send({
          categoryId: other.id,
        });
        expect(moved.status).toBe(200);
        expect(moved.body.categoryId).toBe(other.id);
        const back = await adminPatch(`/api/admin/skills/${skillId}`).send({ categoryId });
        expect(back.body.categoryId).toBe(categoryId);

        await adminPost(`/api/admin/skill-categories/${categoryId}/skills`).send({
          name: 'Segunda',
        });
        expect(await prisma.skill.count({ where: { categoryId } })).toBe(2);
      } finally {
        const del = await adminDelete(`/api/admin/skill-categories/${categoryId}`);
        expect(del.status).toBe(204);
      }
      expect(await prisma.skill.count({ where: { categoryId } })).toBe(0);
      expect((await adminDelete(`/api/admin/skill-categories/${categoryId}`)).status).toBe(404);
    });

    it('validaciones y 404: nombre sin es, categoría inexistente, skill inexistente', async () => {
      const sinNombre = await adminPost('/api/admin/skill-categories').send({ order: 0 });
      expect(sinNombre.status).toBe(400); // D-02: antes 500
      expect(JSON.stringify(sinNombre.body.message)).toContain('name');
      expect(
        (await adminPost('/api/admin/skill-categories').send({ name: { en: 'Data' } })).status,
      ).toBe(400);
      expect(
        (await adminPost('/api/admin/skill-categories/no-existe/skills').send({ name: 'X' }))
          .status,
      ).toBe(404);
      expect((await adminPatch('/api/admin/skills/no-existe').send({ name: 'Y' })).status).toBe(
        404,
      );
      expect((await adminDelete('/api/admin/skills/no-existe')).status).toBe(404);
    });
  });

  // ─── Perfiles curados ───────────────────────────────────────────────────
  describe('CRUD de perfiles curados', () => {
    it('omitir title → 400, no 500 (D-02)', async () => {
      const res = await adminPost('/api/admin/curated-profiles').send({
        slug: 'd02-e2e',
        headline: { es: 'y' },
      });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain('title');
      expect(await prisma.curatedProfile.count({ where: { slug: 'd02-e2e' } })).toBe(0);
    });

    it('sin headline se crea y el hero hereda el titular del perfil base (D7)', async () => {
      const res = await adminPost('/api/admin/curated-profiles').send({
        slug: 'd02-e2e',
        title: { es: 'x' },
      });
      expect(res.status).toBe(201);
      const publico = await get('/api/curated-profiles/d02-e2e');
      expect(publico.body.headline).toBe('');
      expect(publico.body.profile.headline).toBeTruthy();
      await prisma.curatedProfile.deleteMany({ where: { slug: 'd02-e2e' } });
    });

    it('listado admin con campos internos', async () => {
      const res = await adminGet('/api/admin/curated-profiles');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(cv.profileTemplates.length + 1);
      for (const p of res.body as Record<string, unknown>[]) {
        for (const key of [
          'filterTags',
          'includeIds',
          'excludeIds',
          'visibility',
          'accessToken',
          'views',
        ]) {
          expect(p).toHaveProperty(key);
        }
      }
    });

    it('crear mínimo → resoluble; 409 slug duplicado; 400 slug inválido / PROTECTED sin token / themeId; borrar', async () => {
      const created = await adminPost('/api/admin/curated-profiles').send({
        slug: 'qa-lead-e2e',
        title: { es: 'QA Lead' },
        headline: { es: 'Calidad' },
        filterTags: ['testing'],
      });
      expect(created.status).toBe(201);
      const id = created.body.id as string;
      try {
        expect(created.body).toMatchObject({ slug: 'qa-lead-e2e', visibility: 'PUBLIC', views: 0 });
        const pub = await get('/api/curated-profiles/qa-lead-e2e');
        expect(pub.status).toBe(200);
        for (const e of pub.body.experiences as { tags: string[] }[]) {
          expect(e.tags).toContain('testing');
        }

        const base = { title: { es: 'x' }, headline: { es: 'y' } };
        expect(
          (await adminPost('/api/admin/curated-profiles').send({ ...base, slug: 'all' })).status,
        ).toBe(409);
        expect(
          (await adminPost('/api/admin/curated-profiles').send({ ...base, slug: 'QA Lead!' }))
            .status,
        ).toBe(400);

        const noToken = await adminPost('/api/admin/curated-profiles').send({
          ...base,
          slug: 'p-e2e',
          visibility: 'PROTECTED',
        });
        expect(noToken.status).toBe(400);
        expect(JSON.stringify(noToken.body.message)).toContain('accessToken');

        const badTheme = await adminPost('/api/admin/curated-profiles').send({
          ...base,
          slug: 't-e2e',
          themeId: 'no-existe',
        });
        expect(badTheme.status).toBe(400);
        expect(JSON.stringify(badTheme.body.message)).toContain('themeId');

        expect(
          (await adminPatch(`/api/admin/curated-profiles/${id}`).send({ slug: 'all' })).status,
        ).toBe(409);
      } finally {
        expect((await adminDelete(`/api/admin/curated-profiles/${id}`)).status).toBe(204);
      }
      expect((await get('/api/curated-profiles/qa-lead-e2e')).status).toBe(404);
      expect((await adminGet(`/api/admin/curated-profiles/${id}`)).status).toBe(404);
    });

    it('editar filterTags, includeIds/excludeIds y visibilidad cambia la resolución (revertido)', async () => {
      const row = await prisma.curatedProfile.findUniqueOrThrow({
        where: { slug: 'tech-lead-dotnet' },
      });
      const novacomp = await prisma.experience.findFirstOrThrow({ where: { company: 'Novacomp' } });
      const kiwox = await prisma.experience.findFirstOrThrow({
        where: { company: companyOf('kiwox') },
      });
      try {
        const tags = await adminPatch(`/api/admin/curated-profiles/${row.id}`).send({
          filterTags: ['ruby'],
        });
        expect(tags.status).toBe(200);
        const onlyRuby = await get('/api/curated-profiles/tech-lead-dotnet');
        for (const e of onlyRuby.body.experiences as { tags: string[] }[])
          expect(e.tags).toContain('ruby');

        await adminPatch(`/api/admin/curated-profiles/${row.id}`).send({
          filterTags: row.filterTags,
          includeIds: [kiwox.id],
          excludeIds: [novacomp.id],
        });
        const overridden = await get('/api/curated-profiles/tech-lead-dotnet');
        const ids = (overridden.body.experiences as { id: string }[]).map((e) => e.id);
        expect(ids).toContain(kiwox.id);
        expect(ids).not.toContain(novacomp.id);

        const noTok = await adminPatch(`/api/admin/curated-profiles/${row.id}`).send({
          visibility: 'PROTECTED',
        });
        expect(noTok.status).toBe(400);

        const prot = await adminPatch(`/api/admin/curated-profiles/${row.id}`).send({
          visibility: 'PROTECTED',
          accessToken: 'abc123',
        });
        expect(prot.status).toBe(200);
        expect(prot.body.accessToken).toBe('abc123');
        expect((await get('/api/curated-profiles/tech-lead-dotnet')).status).toBe(401);
        expect(
          (await get('/api/curated-profiles/tech-lead-dotnet').set('X-Access-Token', 'abc123'))
            .status,
        ).toBe(200);
      } finally {
        await prisma.curatedProfile.update({
          where: { id: row.id },
          data: {
            filterTags: row.filterTags,
            includeIds: row.includeIds,
            excludeIds: row.excludeIds,
            visibility: row.visibility,
            accessToken: row.accessToken,
          },
        });
      }
    });

    // unify-section-catalog: un id fuera del catálogo se rechaza nombrándolo.
    describe('ids de sección', () => {
      const base = { title: { es: 'x' }, headline: { es: 'y' } };
      const CATALOGO = [
        'hero',
        'stats',
        'experience',
        'skills',
        'projects',
        'education',
        'certifications',
        'presence',
        'contact',
      ];

      it('POST con un id inválido → 400 que lo nombra, y no crea nada', async () => {
        const antes = await prisma.curatedProfile.count();
        const res = await adminPost('/api/admin/curated-profiles').send({
          ...base,
          slug: 'secciones-e2e',
          sectionsOrder: ['hero', 'heroe'],
        });
        expect(res.status).toBe(400);
        expect(JSON.stringify(res.body.message)).toContain('heroe');
        expect(await prisma.curatedProfile.count()).toBe(antes);
      });

      it('PATCH con un id inválido → 400 y el perfil queda igual; los nueve del catálogo → 200', async () => {
        const row = await prisma.curatedProfile.findUniqueOrThrow({
          where: { slug: 'tech-lead-dotnet' },
        });
        try {
          const bad = await adminPatch(`/api/admin/curated-profiles/${row.id}`).send({
            sectionsHidden: ['proyectos'],
          });
          expect(bad.status).toBe(400);
          expect(JSON.stringify(bad.body.message)).toContain('proyectos');
          const intacto = await prisma.curatedProfile.findUniqueOrThrow({ where: { id: row.id } });
          expect(intacto.sectionsHidden).toEqual(row.sectionsHidden);

          const reverso = [...CATALOGO].reverse();
          const ok = await adminPatch(`/api/admin/curated-profiles/${row.id}`).send({
            sectionsOrder: reverso,
          });
          expect(ok.status).toBe(200);
          expect(ok.body.sectionsOrder).toEqual(reverso);
        } finally {
          await prisma.curatedProfile.update({
            where: { id: row.id },
            data: { sectionsOrder: row.sectionsOrder, sectionsHidden: row.sectionsHidden },
          });
        }
      });

      it('preview con un id inválido → 400', async () => {
        const res = await adminPost('/api/admin/curated-profiles/preview').send({
          sectionsOrder: ['hero', 'timeline-3d'],
        });
        expect(res.status).toBe(400);
        expect(JSON.stringify(res.body.message)).toContain('timeline-3d');
      });
    });
  });

  // ─── Analítica ──────────────────────────────────────────────────────────
  describe('registro y agregado de visitas', () => {
    it('cada 200 público registra un ProfileView con hash de IP e incrementa views', async () => {
      const profile = await prisma.curatedProfile.findUniqueOrThrow({ where: { slug: 'all' } });
      const countBefore = await prisma.profileView.count({
        where: { curatedProfileId: profile.id },
      });

      const res = await get('/api/curated-profiles/all?locale=en').set('User-Agent', 'TestUA');
      expect(res.status).toBe(200);

      const countAfter = await prisma.profileView.count({
        where: { curatedProfileId: profile.id },
      });
      expect(countAfter).toBe(countBefore + 1);
      const latest = await prisma.profileView.findFirstOrThrow({
        where: { curatedProfileId: profile.id },
        orderBy: { viewedAt: 'desc' },
      });
      expect(latest.locale).toBe('en');
      expect(latest.userAgent).toBe('TestUA');
      expect(latest.ipHash).toMatch(/^[0-9a-f]{64}$/);
      expect(Date.now() - latest.viewedAt.getTime()).toBeLessThan(10_000);
      for (const value of Object.values(latest)) {
        if (typeof value === 'string') expect(value).not.toMatch(/127\.0\.0\.1|::1/);
      }
      const after = await prisma.curatedProfile.findUniqueOrThrow({ where: { id: profile.id } });
      expect(after.views).toBe(profile.views + 1);
    });

    it('401 y 404 no registran visitas', async () => {
      const row = await prisma.curatedProfile.findUniqueOrThrow({
        where: { slug: 'dotnet-backend' },
      });
      await prisma.curatedProfile.update({
        where: { id: row.id },
        data: { visibility: 'PROTECTED', accessToken: 'tok-e2e' },
      });
      const before = await prisma.profileView.count();
      try {
        expect((await get('/api/curated-profiles/dotnet-backend')).status).toBe(401);
        expect((await get('/api/curated-profiles/no-existe')).status).toBe(404);
        expect(await prisma.profileView.count()).toBe(before);
      } finally {
        await prisma.curatedProfile.update({
          where: { id: row.id },
          data: { visibility: row.visibility, accessToken: row.accessToken },
        });
      }
    });

    it('GET /api/admin/analytics/views agrega por perfil, idioma y día; valida rango', async () => {
      await get('/api/curated-profiles/all?locale=es');
      await get('/api/curated-profiles/all?locale=es');
      const res = await adminGet('/api/admin/analytics/views');
      expect(res.status).toBe(200);
      expect(res.body.total).toBeGreaterThanOrEqual(3);
      const all = (res.body.byProfile as { slug: string; views: number }[]).find(
        (p) => p.slug === 'all',
      );
      expect(all?.views).toBeGreaterThanOrEqual(3);
      const locales = (res.body.byLocale as { locale: string }[]).map((l) => l.locale);
      expect(locales).toEqual(expect.arrayContaining(['es', 'en']));
      expect((res.body.byDay as { day: string; views: number }[]).length).toBeGreaterThan(0);
      expect(res.body.byDay[res.body.byDay.length - 1].day).toBe(
        new Date().toISOString().slice(0, 10),
      );

      expect((await adminGet('/api/admin/analytics/views?from=ayer')).status).toBe(400);
      expect((await get('/api/admin/analytics/views')).status).toBe(401);
    });

    // Defecto D-01: `to` era exclusivo, así que el rango cerrado que manda el
    // panel (`[hoy - (días - 1), hoy]`) dejaba fuera el día en curso.
    it('el rango es cerrado: to=hoy incluye las visitas de hoy', async () => {
      const hoy = new Date().toISOString().slice(0, 10);
      const antes = (await adminGet(`/api/admin/analytics/views?from=${hoy}&to=${hoy}`)).body
        .total as number;

      await get('/api/curated-profiles/all?locale=es');

      const res = await adminGet(`/api/admin/analytics/views?from=${hoy}&to=${hoy}`);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(antes + 1);
      expect(res.body.byDay).toEqual(
        expect.arrayContaining([expect.objectContaining({ day: hoy })]),
      );
    });
  });
});

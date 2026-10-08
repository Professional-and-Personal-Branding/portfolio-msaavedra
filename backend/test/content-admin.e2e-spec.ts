/**
 * E2E — spec `admin-content-management` y `profile-view-analytics` (change
 * `add-profile-content-admin`). Requiere Postgres arriba y la base migrada +
 * seedeada. Todo lo que crea lo borra, y el perfil base vuelve a su estado.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';
import { createE2eAdmin, createTestApp, deleteE2eAdmin, login } from './e2e-helpers';

const MARK = 'E2E contenido';

interface AdminProfile {
  id: string;
  fullName: string;
  headline: { es?: string; en?: string };
  summary: { es?: string; en?: string };
  location: string;
  timezone: string;
  email: string;
  phone: string | null;
  yearsOfExperience: number;
  availability: Record<'modality' | 'contractType' | 'startDate', unknown>;
}

/** El cuerpo del PUT a partir del GET (sin id), para reponer el perfil al terminar. */
function bodyOf(profile: AdminProfile): Record<string, unknown> {
  const { id: _id, ...rest } = profile;
  return rest;
}

describe('Administración de contenido (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let original: AdminProfile;

  const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await createE2eAdmin(prisma);
    token = await login(app);
    original = (await auth(http().get('/api/admin/profile'))).body as AdminProfile;
  });

  afterAll(async () => {
    await auth(http().put('/api/admin/profile')).send(bodyOf(original));
    await prisma.project.deleteMany({ where: { name: { startsWith: MARK } } });
    await prisma.certification.deleteMany({ where: { issuer: MARK } });
    await prisma.education.deleteMany({ where: { institution: MARK } });
    await prisma.socialLink.deleteMany({ where: { handle: MARK } });
    await prisma.language.deleteMany({ where: { name: MARK } });
    await prisma.profileView.deleteMany({ where: { userAgent: MARK } });
    await deleteE2eAdmin(prisma);
    await app.close();
  });

  describe('Perfil base: GET y PUT /api/admin/profile', () => {
    it('sin sesión → 401', async () => {
      await http().get('/api/admin/profile').expect(401);
      await http().put('/api/admin/profile').send(bodyOf(original)).expect(401);
    });

    it('los campos bilingües llegan crudos', () => {
      expect(original.headline).toEqual(expect.objectContaining({ es: expect.any(String) }));
      expect(typeof original.summary).toBe('object');
    });

    it('editar el titular se ve en la home sin correr el seed', async () => {
      const headline = { es: `${MARK} titular`, en: `${MARK} headline` };
      const res = await auth(http().put('/api/admin/profile'))
        .send({ ...bodyOf(original), headline })
        .expect(200);
      expect(res.body.headline).toEqual(headline);

      const home = await http().get('/api/curated-profiles/all?locale=en').expect(200);
      expect(home.body.profile.headline).toBe(`${MARK} headline`);
    });

    it('la disponibilidad llega al hero en el idioma activo', async () => {
      const availability = {
        ...original.availability,
        startDate: { es: 'En dos semanas', en: 'In two weeks' },
      };
      await auth(http().put('/api/admin/profile'))
        .send({ ...bodyOf(original), availability })
        .expect(200);
      const curated = await http().get('/api/curated-profiles/tech-lead-dotnet?locale=en');
      expect(curated.body.profile.availability.startDate).toBe('In two weeks');
    });

    it('un campo desconocido → 400 y el perfil queda igual', async () => {
      const before = (await auth(http().get('/api/admin/profile'))).body as AdminProfile;
      await auth(http().put('/api/admin/profile'))
        .send({ ...bodyOf(original), fullName: 'Otro', rol: 'admin' })
        .expect(400);
      const after = (await auth(http().get('/api/admin/profile'))).body as AdminProfile;
      expect(after).toEqual(before);
    });

    it('un obligatorio vacío → 400 y conserva el email anterior', async () => {
      await auth(http().put('/api/admin/profile'))
        .send({ ...bodyOf(original), email: '' })
        .expect(400);
      const { body } = await auth(http().get('/api/admin/profile'));
      expect(body.email).toBe(original.email);
    });

    it('el preview resuelve el borrador sin guardarlo', async () => {
      const draft = { ...bodyOf(original), headline: { es: 'Solo borrador', en: 'Draft only' } };
      const res = await auth(http().post('/api/admin/profile/preview?locale=en'))
        .send(draft)
        .expect(200);
      expect(res.body.headline).toBe('Draft only');
      const { body } = await auth(http().get('/api/admin/profile'));
      expect(body.headline).not.toEqual(draft.headline);
    });
  });

  describe('CRUD de las entidades del portafolio', () => {
    it('un proyecto nuevo con tags coincidentes aparece en el perfil curado, con su enlace', async () => {
      const curated = await http().get('/api/curated-profiles/tech-lead-dotnet');
      const tags = (
        await prisma.curatedProfile.findUniqueOrThrow({
          where: { slug: 'tech-lead-dotnet' },
          select: { filterTags: true },
        })
      ).filterTags;
      expect(curated.status).toBe(200);

      const res = await auth(http().post('/api/admin/projects'))
        .send({
          name: `${MARK} proyecto`,
          role: { es: 'Autor', en: 'Author' },
          period: '2026',
          summary: { es: 'Resumen' },
          tags: [tags[0]],
          url: 'https://github.com/manu/e2e',
        })
        .expect(201);
      expect(res.body).toMatchObject({ visible: true, url: 'https://github.com/manu/e2e' });

      const after = await http().get('/api/curated-profiles/tech-lead-dotnet').expect(200);
      const found = (after.body.projects as { name: string; url: string | null }[]).find(
        (p) => p.name === `${MARK} proyecto`,
      );
      expect(found?.url).toBe('https://github.com/manu/e2e');
    });

    it('ocultar una certificación la saca de la vista pública y sigue en el panel', async () => {
      const created = await auth(http().post('/api/admin/certifications'))
        .send({ name: { es: `${MARK} cert` }, issuer: MARK, year: '2026' })
        .expect(201);
      const id = created.body.id as string;

      await auth(http().patch(`/api/admin/certifications/${id}`))
        .send({ visible: false })
        .expect(200);

      const publicList = await http().get('/api/certifications').expect(200);
      expect((publicList.body as { issuer: string }[]).some((c) => c.issuer === MARK)).toBe(false);
      const admin = await auth(http().get('/api/admin/certifications')).expect(200);
      const row = (admin.body as { id: string; visible: boolean }[]).find((c) => c.id === id);
      expect(row).toMatchObject({ visible: false });
    });

    it('el listado crudo incluye la formación oculta, con visible y order', async () => {
      const created = await auth(http().post('/api/admin/education'))
        .send({
          degree: { es: `${MARK} grado` },
          institution: MARK,
          startDate: '2020-01',
          endDate: '2021-01',
          visible: false,
          order: 99,
        })
        .expect(201);
      const { body } = await auth(http().get('/api/admin/education')).expect(200);
      const row = (body as { id: string }[]).find((e) => e.id === created.body.id);
      expect(row).toMatchObject({ visible: false, order: 99, degree: { es: `${MARK} grado` } });
    });

    it('borrar un enlace social lo saca de la vista pública', async () => {
      const created = await auth(http().post('/api/admin/social-links'))
        .send({
          platform: 'e2e',
          handle: MARK,
          url: 'https://example.com/e2e',
          label: { es: 'E2E' },
        })
        .expect(201);
      const id = created.body.id as string;
      expect(
        ((await http().get('/api/social-links')).body as { id: string }[]).some((s) => s.id === id),
      ).toBe(true);

      await auth(http().delete(`/api/admin/social-links/${id}`)).expect(204);
      expect(
        ((await http().get('/api/social-links')).body as { id: string }[]).some((s) => s.id === id),
      ).toBe(false);
      await auth(http().get(`/api/admin/social-links/${id}`)).expect(404);
    });

    it('stats malformado → 400', async () => {
      await auth(http().post('/api/admin/social-links'))
        .send({
          platform: 'e2e',
          handle: MARK,
          url: 'https://example.com/e2e',
          label: { es: 'E2E' },
          stats: [1, 2],
        })
        .expect(400);
    });

    it('idiomas: crear, editar y borrar en el perfil base', async () => {
      const created = await auth(http().post('/api/admin/languages'))
        .send({ name: MARK, level: 'A1' })
        .expect(201);
      const id = created.body.id as string;
      await auth(http().patch(`/api/admin/languages/${id}`))
        .send({ level: 'B1' })
        .expect(200);
      const profile = await http().get('/api/profile').expect(200);
      expect(profile.body.languages).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: MARK, level: 'B1' })]),
      );
      await auth(http().delete(`/api/admin/languages/${id}`)).expect(204);
    });

    it.each([
      ['/api/admin/projects', { name: 'x', role: { es: 'x' }, period: '1', summary: { es: 'x' } }],
      ['/api/admin/education', { degree: { es: 'x' }, institution: 'x', startDate: '2020-01' }],
      ['/api/admin/certifications', { name: { es: 'x' }, issuer: 'x' }],
      [
        '/api/admin/social-links',
        { platform: 'x', handle: 'x', url: 'https://x.dev', label: { es: 'x' } },
      ],
      ['/api/admin/languages', { name: 'x', level: 'x' }],
    ])('POST %s con un campo desconocido → 400', async (url, body) => {
      await auth(http().post(url))
        .send({ ...body, desconocido: true })
        .expect(400);
    });

    it.each([
      '/api/admin/projects',
      '/api/admin/education',
      '/api/admin/certifications',
      '/api/admin/social-links',
      '/api/admin/languages',
    ])('%s sin sesión → 401', async (url) => {
      await http().get(url).expect(401);
    });
  });

  describe('Analítica por origen', () => {
    it('byReferrer normaliza el host y suma lo mismo que total', async () => {
      const ref = (referrer?: string) => {
        const req = http().get('/api/curated-profiles/all').set('User-Agent', MARK);
        return referrer ? req.set('Referer', referrer) : req;
      };
      await ref('https://www.linkedin.com/feed/?trk=x').expect(200);
      await ref().expect(200);

      const today = new Date().toISOString().slice(0, 10);
      const { body } = await auth(
        http().get(`/api/admin/analytics/views?from=${today}&to=${today}`),
      ).expect(200);
      const byReferrer = body.byReferrer as { referrer: string; views: number }[];
      expect(byReferrer.map((r) => r.referrer)).toEqual(
        expect.arrayContaining(['linkedin.com', 'directo']),
      );
      expect(byReferrer.some((r) => /[/?]/.test(r.referrer))).toBe(false);
      expect(byReferrer.reduce((acc, r) => acc + r.views, 0)).toBe(body.total);
    });
  });
});

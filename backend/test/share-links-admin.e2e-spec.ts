/**
 * E2E — change `add-share-links`: API del panel para los enlaces de seguimiento
 * (`/api/admin/curated-profiles/:id/share-links`) y su ciclo de vida con el perfil.
 * Los perfiles de prueba llevan el prefijo `sla-e2e` y se borran al final.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';
import {
  BROWSER_UA,
  createE2eAdmin,
  createTestApp,
  deleteE2eAdmin,
  login,
  settleBackgroundTasks,
} from './e2e-helpers';

const SLUG = 'sla-e2e-perfil';
const OTHER = 'sla-e2e-otro';
const ALL_SLUGS = [
  SLUG,
  OTHER,
  'sla-e2e-publico',
  'sla-e2e-publico-borrar',
  'sla-e2e-protegido',
  'sla-e2e-privado',
  'sla-e2e-duplicar',
  'sla-e2e-duplicar-2',
  'sla-e2e-ciclo',
  'sla-e2e-ciclo-nuevo',
];
const ALPHABET = /^[0-9a-hjkmnp-tv-z]{10}$/;

interface LinkBody {
  id: string;
  code: string;
  label: string;
  portal: string | null;
  kind: string;
  createdAt: string;
  revokedAt: string | null;
  opens: number;
  lastOpenedAt: string | null;
}

describe('Enlaces de seguimiento: API del panel (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bearer: string;
  let profileId: string;
  let otherId: string;

  const server = () => app.getHttpServer();
  const auth = () => ({ Authorization: `Bearer ${bearer}` });
  const base = (id = profileId) => `/api/admin/curated-profiles/${id}/share-links`;

  async function createProfile(slug: string, extra: Record<string, unknown> = {}) {
    const res = await request(server())
      .post('/api/admin/curated-profiles')
      .set(auth())
      .send({
        slug,
        title: { es: slug, en: slug },
        headline: { es: 'Titular', en: 'Headline' },
        filterTags: [],
        ...extra,
      });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  const create = (body: Record<string, unknown>, id = profileId) =>
    request(server()).post(base(id)).set(auth()).send(body);

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await prisma.curatedProfile.deleteMany({ where: { slug: { in: ALL_SLUGS } } });
    await createE2eAdmin(prisma);
    bearer = await login(app);
    profileId = await createProfile(SLUG);
    otherId = await createProfile(OTHER);
  });

  afterAll(async () => {
    await prisma.curatedProfile.deleteMany({ where: { slug: { in: ALL_SLUGS } } });
    await deleteE2eAdmin(prisma);
    await app.close();
  });

  describe('crear y listar', () => {
    it('crea con portal normalizado, kind MANUAL, sin revocar y con 0 aperturas', async () => {
      const res = await create({ label: 'Acme — RR. HH.', portal: 'LinkedIn' });
      expect(res.status).toBe(201);
      const body = res.body as LinkBody;
      expect(body).toMatchObject({
        label: 'Acme — RR. HH.',
        portal: 'linkedin',
        kind: 'MANUAL',
        revokedAt: null,
        opens: 0,
        lastOpenedAt: null,
      });
      expect(body.code).toMatch(ALPHABET);
    });

    it('dos enlaces tienen códigos distintos y el listado trae el más reciente primero', async () => {
      const first = (await create({ label: 'Primero' })).body as LinkBody;
      const second = (await create({ label: 'Segundo' })).body as LinkBody;
      expect(second.code).not.toBe(first.code);
      const list = await request(server()).get(base()).set(auth()).expect(200);
      const labels = (list.body as LinkBody[]).map((l) => l.label);
      expect(labels.indexOf('Segundo')).toBeLessThan(labels.indexOf('Primero'));
    });

    it('etiqueta vacía, de 81 o portal inválido: 400 y no se crea nada', async () => {
      const before = await prisma.shareLink.count({ where: { curatedProfileId: profileId } });
      expect((await create({ label: '' })).status).toBe(400);
      expect((await create({ label: 'x'.repeat(81) })).status).toBe(400);
      expect((await create({ label: 'Acme', portal: 'mi portal!' })).status).toBe(400);
      expect((await create({ label: 'Acme', portal: 'a'.repeat(33) })).status).toBe(400);
      expect((await create({})).status).toBe(400);
      expect((await create({ label: 'Acme', code: 'abcdefghij' })).status).toBe(400);
      expect(await prisma.shareLink.count({ where: { curatedProfileId: profileId } })).toBe(before);
    });

    it('perfil inexistente: 404', async () => {
      expect((await create({ label: 'X' }, 'no-existe')).status).toBe(404);
      await request(server()).get(base('no-existe')).set(auth()).expect(404);
    });

    it('sin token: 401', async () => {
      await request(server()).get(base()).expect(401);
      await request(server()).post(base()).send({ label: 'X' }).expect(401);
      await request(server()).post(`${base()}/linkedin`).expect(401);
    });
  });

  describe('renombrar y revocar', () => {
    it('renombrar cambia solo la etiqueta', async () => {
      const link = (await create({ label: 'Original', portal: 'indeed' })).body as LinkBody;
      const res = await request(server())
        .patch(`${base()}/${link.id}`)
        .set(auth())
        .send({ label: '  Nueva  ' })
        .expect(200);
      expect(res.body).toMatchObject({
        id: link.id,
        label: 'Nueva',
        code: link.code,
        portal: 'indeed',
      });
      await request(server())
        .patch(`${base()}/${link.id}`)
        .set(auth())
        .send({ label: '' })
        .expect(400);
      await request(server())
        .patch(`${base()}/${link.id}`)
        .set(auth())
        .send({ label: 'x', code: 'otro' })
        .expect(400);
    });

    it('revocar dos veces: 200 con el mismo revokedAt', async () => {
      const link = (await create({ label: 'A revocar' })).body as LinkBody;
      const first = await request(server()).post(`${base()}/${link.id}/revoke`).set(auth());
      const second = await request(server()).post(`${base()}/${link.id}/revoke`).set(auth());
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(first.body.revokedAt).not.toBeNull();
      expect(second.body.revokedAt).toBe(first.body.revokedAt);
    });

    it('un enlace de otro perfil o inexistente: 404 y el enlace no cambia', async () => {
      const link = (await create({ label: 'Del perfil' })).body as LinkBody;
      await request(server())
        .post(`${base(otherId)}/${link.id}/revoke`)
        .set(auth())
        .expect(404);
      await request(server())
        .patch(`${base(otherId)}/${link.id}`)
        .set(auth())
        .send({ label: 'Cambio ajeno' })
        .expect(404);
      await request(server()).post(`${base()}/no-existe/revoke`).set(auth()).expect(404);
      const row = await prisma.shareLink.findUniqueOrThrow({ where: { id: link.id } });
      expect(row.revokedAt).toBeNull();
      expect(row.label).toBe('Del perfil');
    });

    it('no hay ruta para borrar un enlace', async () => {
      const link = (await create({ label: 'Permanente' })).body as LinkBody;
      await request(server()).delete(`${base()}/${link.id}`).set(auth()).expect(404);
    });
  });

  describe('aperturas', () => {
    it('cuenta 3 HUMAN y no las OWNER ni las BOT; lastOpenedAt es la última HUMAN', async () => {
      const link = (await create({ label: 'Aperturas' })).body as LinkBody;
      const visit = async (headers: Record<string, string>) => {
        await request(server())
          .get(`/api/curated-profiles/${SLUG}?via=${link.code}`)
          .set(headers)
          .expect(200);
        await settleBackgroundTasks(app);
      };
      const empty = (await request(server()).get(base()).set(auth())).body as LinkBody[];
      expect(empty.find((l) => l.id === link.id)).toMatchObject({ opens: 0, lastOpenedAt: null });

      await visit({ 'User-Agent': BROWSER_UA });
      await visit({ 'User-Agent': BROWSER_UA });
      await visit({ 'User-Agent': BROWSER_UA });
      const lastHuman = await prisma.profileView.findFirstOrThrow({
        where: { shareLinkId: link.id, kind: 'HUMAN' },
        orderBy: { viewedAt: 'desc' },
      });
      await visit({ 'User-Agent': BROWSER_UA, Authorization: `Bearer ${bearer}` });
      await visit({ 'User-Agent': 'Googlebot/2.1' });
      await visit({});

      const list = (await request(server()).get(base()).set(auth())).body as LinkBody[];
      const found = list.find((l) => l.id === link.id);
      expect(found?.opens).toBe(3);
      expect(found?.lastOpenedAt).toBe(lastHuman.viewedAt.toISOString());
      expect(await prisma.profileView.count({ where: { shareLinkId: link.id } })).toBe(6);
    });
  });

  describe('Compartir en LinkedIn', () => {
    it('la primera vez 201, la segunda 200 con el mismo código; revocado, 201 con otro', async () => {
      const id = await createProfile('sla-e2e-publico');
      const first = await request(server())
        .post(`${base(id)}/linkedin`)
        .set(auth());
      const second = await request(server())
        .post(`${base(id)}/linkedin`)
        .set(auth());
      expect(first.status).toBe(201);
      expect(second.status).toBe(200);
      expect(first.body).toMatchObject({ kind: 'LINKEDIN_POST', portal: 'linkedin' });
      expect(second.body.code).toBe(first.body.code);

      await request(server())
        .post(`${base(id)}/${first.body.id}/revoke`)
        .set(auth())
        .expect(200);
      const third = await request(server())
        .post(`${base(id)}/linkedin`)
        .set(auth());
      expect(third.status).toBe(201);
      expect(third.body.code).not.toBe(first.body.code);
    });

    it('PROTECTED, PRIVATE y archivado: 409 y no se crea ningún enlace', async () => {
      const protectedId = await createProfile('sla-e2e-protegido', {
        visibility: 'PROTECTED',
        accessToken: 'tok-sla',
      });
      const privateId = await createProfile('sla-e2e-privado', { visibility: 'PRIVATE' });
      const archivedId = otherId;
      await request(server()).post(`/api/admin/curated-profiles/${archivedId}/archive`).set(auth());
      try {
        for (const id of [protectedId, privateId, archivedId]) {
          await request(server())
            .post(`${base(id)}/linkedin`)
            .set(auth())
            .expect(409);
          expect(await prisma.shareLink.count({ where: { curatedProfileId: id } })).toBe(0);
        }
      } finally {
        await request(server())
          .post(`/api/admin/curated-profiles/${archivedId}/unarchive`)
          .set(auth());
      }
    });

    it('perfil inexistente: 404', async () => {
      await request(server())
        .post(`${base('no-existe')}/linkedin`)
        .set(auth())
        .expect(404);
    });
  });

  describe('ciclo de vida con el perfil', () => {
    it('borrar un perfil con dos enlaces los borra (y no deja visitas colgadas)', async () => {
      const id = await createProfile('sla-e2e-publico-borrar');
      const a = (await create({ label: 'Uno' }, id)).body as LinkBody;
      await create({ label: 'Dos' }, id);
      await request(server()).get(`/api/curated-profiles/sla-e2e-publico-borrar?via=${a.code}`);
      await settleBackgroundTasks(app);
      await request(server()).delete(`/api/admin/curated-profiles/${id}`).set(auth()).expect(204);
      expect(await prisma.shareLink.count({ where: { curatedProfileId: id } })).toBe(0);
      expect(await prisma.profileView.count({ where: { curatedProfileId: id } })).toBe(0);
    });

    it('duplicar un perfil con tres enlaces: el duplicado no tiene ninguno y el original conserva los tres', async () => {
      const id = await createProfile('sla-e2e-duplicar');
      for (const label of ['Uno', 'Dos', 'Tres']) await create({ label }, id);
      const copy = await request(server())
        .post(`/api/admin/curated-profiles/${id}/duplicate`)
        .set(auth())
        .send({})
        .expect(201);
      const copyLinks = await request(server()).get(base(copy.body.id)).set(auth()).expect(200);
      expect(copyLinks.body).toEqual([]);
      const originalLinks = await request(server()).get(base(id)).set(auth()).expect(200);
      expect(originalLinks.body).toHaveLength(3);
    });

    it('archivar no toca los enlaces y renombrar el slug tampoco', async () => {
      const id = await createProfile('sla-e2e-ciclo');
      const link = (await create({ label: 'Ciclo' }, id)).body as LinkBody;
      await request(server()).post(`/api/admin/curated-profiles/${id}/archive`).set(auth());
      const list = await request(server()).get(base(id)).set(auth()).expect(200);
      expect(list.body).toHaveLength(1);
      expect(list.body[0].revokedAt).toBeNull();
      await request(server()).post(`/api/admin/curated-profiles/${id}/unarchive`).set(auth());
      await request(server())
        .patch(`/api/admin/curated-profiles/${id}`)
        .set(auth())
        .send({ slug: 'sla-e2e-ciclo-nuevo' })
        .expect(200);
      const row = await prisma.shareLink.findUniqueOrThrow({ where: { id: link.id } });
      expect(row.curatedProfileId).toBe(id);
      expect(row.code).toBe(link.code);
    });
  });
});

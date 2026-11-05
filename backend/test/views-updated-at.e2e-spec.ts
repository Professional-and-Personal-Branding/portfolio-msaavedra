/**
 * E2E — change `polish-views-updated-at-and-builder` (D1, D2, D4): una visita no es una edición.
 * El incremento de `views` (registro público y `views:reclassify`) no debe mover
 * `CuratedProfile.updatedAt`, y con él el `<lastmod>` del sitemap.
 *
 * `<lastmod>` tiene granularidad de día y el seed se carga el mismo día que corren los tests:
 * por eso el test fija `updatedAt` en una fecha vieja ANTES de visitar.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { applyReclassification, ReclassificationPlan } from '../scripts/lib/reclassify-views';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';
import {
  BROWSER_UA,
  createE2eAdmin,
  createTestApp,
  deleteE2eAdmin,
  login,
  settleBackgroundTasks,
} from './e2e-helpers';

const SLUG = 'tech-lead-dotnet';
const MARK = 'ViewsUpdatedAtE2E';
const FIXED = new Date('2026-01-15T12:00:00.000Z');

describe('Las visitas no mueven updatedAt (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let profileId: string;
  let original: { updatedAt: Date; views: number };
  const server = () => app.getHttpServer();

  const profile = () => prisma.curatedProfile.findUniqueOrThrow({ where: { id: profileId } });
  const sitemap = async () => (await request(server()).get('/sitemap.xml').expect(200)).text;
  /** `<lastmod>` del perfil: el que sigue a su `<loc>` en el sitemap. */
  const lastmod = async () =>
    new RegExp(String.raw`<loc>[^<]*/${SLUG}</loc>\s*<lastmod>([^<]+)</lastmod>`).exec(
      await sitemap(),
    )?.[1];

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await createE2eAdmin(prisma);
    token = await login(app);
    const row = await prisma.curatedProfile.findUniqueOrThrow({ where: { slug: SLUG } });
    profileId = row.id;
    original = { updatedAt: row.updatedAt, views: row.views };
    // Escritura de preparación: fija la fecha de la última edición.
    await prisma.curatedProfile.update({ where: { id: profileId }, data: { updatedAt: FIXED } });
  });

  afterAll(async () => {
    await settleBackgroundTasks(app);
    await prisma.profileView.deleteMany({ where: { userAgent: MARK } });
    await prisma.curatedProfile.update({
      where: { id: profileId },
      data: { updatedAt: original.updatedAt, views: original.views },
    });
    await deleteE2eAdmin(prisma);
    await app.close();
  });

  it('una visita HUMAN suma en views y deja updatedAt y el <lastmod> intactos', async () => {
    const before = await profile();
    expect(before.updatedAt.toISOString()).toBe(FIXED.toISOString());

    await request(server())
      .get(`/api/curated-profiles/${SLUG}`)
      .set('User-Agent', `${BROWSER_UA} ${MARK}`)
      .expect(200);
    await settleBackgroundTasks(app);

    const after = await profile();
    expect(after.views).toBe(before.views + 1);
    expect(after.updatedAt.toISOString()).toBe(FIXED.toISOString());
    expect(await lastmod()).toBe('2026-01-15');
  });

  it('control: un PATCH del perfil sí mueve updatedAt y el <lastmod>', async () => {
    await prisma.curatedProfile.update({ where: { id: profileId }, data: { updatedAt: FIXED } });
    const current = await profile();
    const today = new Date().toISOString().slice(0, 10);
    expect(await lastmod()).toBe('2026-01-15');

    await request(server())
      .patch(`/api/admin/curated-profiles/${profileId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ techFocus: current.techFocus ?? '.NET' })
      .expect(200);

    expect((await profile()).updatedAt.getTime()).toBeGreaterThan(FIXED.getTime());
    expect(await lastmod()).toBe(today);
  });

  it('views:reclassify escribe views sin mover updatedAt', async () => {
    await prisma.curatedProfile.update({ where: { id: profileId }, data: { updatedAt: FIXED } });
    const before = await profile();
    const expected = before.views + 7;
    const plan: ReclassificationPlan = {
      rows: 0,
      toBot: [],
      toHuman: [],
      before: { HUMAN: 0, OWNER: 0, BOT: 0 },
      after: { HUMAN: 0, OWNER: 0, BOT: 0 },
      profileChanges: [{ id: profileId, slug: SLUG, current: before.views, expected }],
      hasChanges: true,
    };

    await applyReclassification(prisma, plan);

    const after = await profile();
    expect(after.views).toBe(expected);
    expect(after.updatedAt.toISOString()).toBe(FIXED.toISOString());
    expect(await lastmod()).toBe('2026-01-15');
  });
});

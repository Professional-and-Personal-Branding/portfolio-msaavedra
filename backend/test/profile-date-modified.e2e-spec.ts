/**
 * E2E — change `fix-error-contrast-and-date-modified` (D5 a D9): `dateModified` del JSON-LD,
 * `updatedAt` de la API pública y `<lastmod>` del sitemap salen del mismo dato (la última edición
 * del perfil curado) y coinciden; una visita no lo mueve.
 *
 * Usa su propia app (caché del head vacía) y fija `updatedAt` antes de pedir nada.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';
import { BROWSER_UA, createTestApp, settleBackgroundTasks } from './e2e-helpers';

const SLUG = 'tech-lead-dotnet';
const MARK = 'ProfileDateModifiedE2E';
const FIXED = new Date('2026-01-15T12:00:00.000Z');
const SCRIPT = /<script type="application\/ld\+json">(.*?)<\/script>/s;

describe('dateModified, updatedAt y <lastmod> coinciden (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let profileId: string;
  let original: { updatedAt: Date; views: number };
  const server = () => app.getHttpServer();

  /** El `ProfilePage` del fragmento de head, parseado. */
  const headJsonLd = async (): Promise<Record<string, unknown>> => {
    const html = (await request(server()).get(`/api/public/profile-head?slug=${SLUG}`).expect(200))
      .text;
    const raw = SCRIPT.exec(html)?.[1];
    expect(raw).toBeDefined();
    return JSON.parse(raw ?? '{}') as Record<string, unknown>;
  };
  const api = async () =>
    (await request(server()).get(`/api/curated-profiles/${SLUG}`).expect(200)).body as {
      updatedAt: string | null;
    };
  const lastmod = async () =>
    new RegExp(String.raw`<loc>[^<]*/${SLUG}</loc>\s*<lastmod>([^<]+)</lastmod>`).exec(
      (await request(server()).get('/sitemap.xml').expect(200)).text,
    )?.[1];

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    const row = await prisma.curatedProfile.findUniqueOrThrow({ where: { slug: SLUG } });
    profileId = row.id;
    original = { updatedAt: row.updatedAt, views: row.views };
    await prisma.curatedProfile.update({ where: { id: profileId }, data: { updatedAt: FIXED } });
  });

  afterAll(async () => {
    await settleBackgroundTasks(app);
    await prisma.profileView.deleteMany({ where: { userAgent: MARK } });
    await prisma.curatedProfile.update({
      where: { id: profileId },
      data: { updatedAt: original.updatedAt, views: original.views },
    });
    await app.close();
  });

  it('el fragmento, la API pública y el sitemap dan el mismo día', async () => {
    const ld = await headJsonLd();
    expect(ld.dateModified).toBe('2026-01-15');
    expect((await api()).updatedAt).toBe('2026-01-15T12:00:00.000Z');
    expect(await lastmod()).toBe('2026-01-15');
  });

  it('dateModified va entre inLanguage y mainEntity', async () => {
    const keys = Object.keys(await headJsonLd());
    expect(keys.indexOf('dateModified')).toBe(keys.indexOf('inLanguage') + 1);
    expect(keys.indexOf('mainEntity')).toBe(keys.indexOf('dateModified') + 1);
  });

  it('una visita humana no mueve updatedAt ni dateModified ni el <lastmod>', async () => {
    const before = await prisma.curatedProfile.findUniqueOrThrow({ where: { id: profileId } });

    await request(server())
      .get(`/api/curated-profiles/${SLUG}`)
      .set('User-Agent', `${BROWSER_UA} ${MARK}`)
      .expect(200);
    await settleBackgroundTasks(app);

    const after = await prisma.curatedProfile.findUniqueOrThrow({ where: { id: profileId } });
    expect(after.views).toBe(before.views + 1);
    expect((await api()).updatedAt).toBe('2026-01-15T12:00:00.000Z');
    expect(await lastmod()).toBe('2026-01-15');
  });
});

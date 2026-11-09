/**
 * E2E — spec `cv-consistency` (change `add-cv-consistency-rules`, D9 y D10). Requiere Postgres
 * arriba y la base migrada + seedeada. Es una lectura: se comprueba que no escribe nada.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';
import { createE2eAdmin, createTestApp, deleteE2eAdmin, login } from './e2e-helpers';

interface Issue {
  code: string;
  severity: 'error' | 'warning' | 'info';
  entityType: string;
  entityId: string;
  entityLabel: string;
  field: string | null;
  message: string;
  params: Record<string, string | number>;
}
interface Report {
  asOf: string;
  experience: { declaredYears: number; derivedMonths: number } | null;
  summary: { error: number; warning: number; info: number };
  issues: Issue[];
}

describe('Revisión de consistencia del CV (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  const http = () => request(app.getHttpServer());
  const get = (query = '') =>
    http().get(`/api/admin/consistency${query}`).set('Authorization', `Bearer ${token}`);

  /** Conteos de las tablas de contenido (nada de esto puede cambiar con una lectura). */
  const counts = async () => ({
    profile: await prisma.profile.count(),
    language: await prisma.language.count(),
    experience: await prisma.experience.count(),
    skillCategory: await prisma.skillCategory.count(),
    skill: await prisma.skill.count(),
    education: await prisma.education.count(),
    certification: await prisma.certification.count(),
    project: await prisma.project.count(),
    socialLink: await prisma.socialLink.count(),
    curatedProfile: await prisma.curatedProfile.count(),
    profileView: await prisma.profileView.count(),
  });

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await createE2eAdmin(prisma);
    token = await login(app);
  });

  afterAll(async () => {
    await deleteE2eAdmin(prisma);
    await app.close();
  });

  it('sin sesión → 401', async () => {
    await http().get('/api/admin/consistency').expect(401);
  });

  it('con sesión → 200 con summary, experience y 0 errores sobre el seed', async () => {
    const res = await get().expect(200);
    const body = res.body as Report;
    expect(body.asOf).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
    expect(body.experience).toEqual({
      declaredYears: expect.any(Number),
      derivedMonths: expect.any(Number),
    });
    expect(body.summary.error).toBe(0);
    expect(body.summary).toEqual({
      error: body.issues.filter((i) => i.severity === 'error').length,
      warning: body.issues.filter((i) => i.severity === 'warning').length,
      info: body.issues.filter((i) => i.severity === 'info').length,
    });
    for (const found of body.issues) {
      expect(found.message.length).toBeGreaterThan(0);
      expect(found.entityLabel.length).toBeGreaterThan(0);
      expect(found.entityId.length).toBeGreaterThan(0);
    }
  });

  it('?locale=en cambia el mensaje y no el código', async () => {
    const es = (await get('?locale=es').expect(200)).body as Report;
    const en = (await get('?locale=en').expect(200)).body as Report;
    expect(en.issues.map((i) => [i.code, i.entityId])).toEqual(
      es.issues.map((i) => [i.code, i.entityId]),
    );
    if (es.issues.length > 0) {
      expect(en.issues[0].message).not.toBe(es.issues[0].message);
    }
  });

  it('responde Cache-Control: no-store', async () => {
    const res = await get().expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('el orden de los hallazgos es estable entre corridas', async () => {
    const first = (await get().expect(200)).body as Report;
    const second = (await get().expect(200)).body as Report;
    expect(second.issues).toEqual(first.issues);
  });

  it('no escribe: los conteos de las tablas no cambian', async () => {
    const before = await counts();
    await get().expect(200);
    await get('?locale=en').expect(200);
    expect(await counts()).toEqual(before);
  });
});

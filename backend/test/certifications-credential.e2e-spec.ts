/**
 * E2E — change `add-certification-verification`: enlace de verificación, ID y vencimiento de
 * una certificación. Requiere Postgres arriba, migrado y sembrado con `docs/cv-data.json`
 * (sin credenciales). Todo lo que crea lo borra.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';
import { createE2eAdmin, createTestApp, deleteE2eAdmin, login } from './e2e-helpers';

const ISSUER = 'E2E credencial';
const CREDENTIAL = {
  verificationUrl: 'https://example.org/credenciales/e2e-1',
  credentialId: 'E2E-2023-0042',
  expiresAt: '2029-06',
};

interface CertificationBody {
  id: string;
  issuer: string;
  verificationUrl: string | null;
  credentialId: string | null;
  expiresAt: string | null;
}

describe('Credencial de una certificación (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let id: string;

  const http = () => request(app.getHttpServer());
  const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);
  const count = () => prisma.certification.count({ where: { issuer: ISSUER } });

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await createE2eAdmin(prisma);
    token = await login(app);
    await prisma.certification.deleteMany({ where: { issuer: ISSUER } });
  });

  afterAll(async () => {
    await prisma.certification.deleteMany({ where: { issuer: ISSUER } });
    await deleteE2eAdmin(prisma);
    await app.close();
  });

  it('tras el seed los tres campos son null en el listado público y en la vista curada', async () => {
    const list = await http().get('/api/certifications').expect(200);
    expect((list.body as CertificationBody[]).length).toBeGreaterThan(0);
    for (const c of list.body as CertificationBody[]) {
      expect(c).toEqual(
        expect.objectContaining({ verificationUrl: null, credentialId: null, expiresAt: null }),
      );
    }
    const home = await http().get('/api/curated-profiles/all').expect(200);
    for (const c of home.body.certifications as CertificationBody[]) {
      expect(c).toEqual(
        expect.objectContaining({ verificationUrl: null, credentialId: null, expiresAt: null }),
      );
    }
  });

  it('sin token → 401', async () => {
    await http().post('/api/admin/certifications').send({}).expect(401);
    await http().patch('/api/admin/certifications/x').send({}).expect(401);
  });

  describe('POST inválido → 400 sin crear', () => {
    const base = { name: { es: 'Nube', en: 'Cloud' }, issuer: ISSUER, year: '2023' };

    it.each([
      ['http://', { verificationUrl: 'http://example.org/c/1' }],
      ['javascript:', { verificationUrl: 'javascript:alert(1)' }],
      ['relativa', { verificationUrl: '/c/1' }],
      ['ID de 101 caracteres', { credentialId: 'x'.repeat(101) }],
      ['vencimiento mal formado', { expiresAt: '06/2029' }],
      ['vencimiento anterior al año', { expiresAt: '2022-12' }],
      ['campo desconocido', { credential: 'x' }],
    ])('%s', async (_nombre, extra) => {
      await auth(http().post('/api/admin/certifications'))
        .send({ ...base, ...extra })
        .expect(400);
      expect(await count()).toBe(0);
    });
  });

  it('POST válido crea la certificación con la credencial', async () => {
    const res = await auth(http().post('/api/admin/certifications'))
      .send({ name: { es: 'Nube', en: 'Cloud' }, issuer: ISSUER, year: '2023', ...CREDENTIAL })
      .expect(201);
    id = (res.body as CertificationBody).id;
    expect(res.body).toEqual(expect.objectContaining(CREDENTIAL));
  });

  it('PATCH con los tres campos → 200 y aparecen en panel, API pública (es y en) y vista curada', async () => {
    const created = await auth(http().post('/api/admin/certifications'))
      .send({ name: { es: 'Otra', en: 'Other' }, issuer: ISSUER, year: '2023' })
      .expect(201);
    const otherId = (created.body as CertificationBody).id;
    await auth(http().patch(`/api/admin/certifications/${otherId}`))
      .send(CREDENTIAL)
      .expect(200);

    const admin = await auth(http().get('/api/admin/certifications')).expect(200);
    expect((admin.body as CertificationBody[]).find((c) => c.id === otherId)).toEqual(
      expect.objectContaining(CREDENTIAL),
    );

    for (const locale of ['es', 'en']) {
      const list = await http().get(`/api/certifications?locale=${locale}`).expect(200);
      const found = (list.body as CertificationBody[]).find((c) => c.id === otherId);
      expect(found).toEqual(expect.objectContaining(CREDENTIAL));
      expect(found).not.toHaveProperty('expired');
    }
    const home = await http().get('/api/curated-profiles/all').expect(200);
    const inHome = (home.body.certifications as CertificationBody[]).find((c) => c.id === otherId);
    expect(inHome).toEqual(expect.objectContaining(CREDENTIAL));
    expect(inHome).not.toHaveProperty('expired');
  });

  it('PATCH con un valor inválido → 400 y la certificación no cambia', async () => {
    const patch = (body: object) =>
      auth(http().patch(`/api/admin/certifications/${id}`)).send(body);
    await patch({ verificationUrl: 'http://example.org/c/1' }).expect(400);
    await patch({ credentialId: 'x'.repeat(101) }).expect(400);
    // Cruzada: el año de la certificación (2023) contra un vencimiento anterior.
    await patch({ expiresAt: '2022-12' }).expect(400);
    await patch({ year: '2031' }).expect(400);
    await patch({ campoDesconocido: 1 }).expect(400);

    const row = await prisma.certification.findUnique({ where: { id } });
    expect(row).toMatchObject({ year: '2023', ...CREDENTIAL });
  });

  it('PATCH { verificationUrl: null } quita solo el enlace', async () => {
    const res = await auth(http().patch(`/api/admin/certifications/${id}`))
      .send({ verificationUrl: null })
      .expect(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        verificationUrl: null,
        credentialId: CREDENTIAL.credentialId,
        expiresAt: CREDENTIAL.expiresAt,
      }),
    );
  });

  it('PATCH de otro campo no toca la credencial', async () => {
    await auth(http().patch(`/api/admin/certifications/${id}`))
      .send({ order: 7 })
      .expect(200);
    const row = await prisma.certification.findUnique({ where: { id } });
    expect(row).toMatchObject({
      credentialId: CREDENTIAL.credentialId,
      expiresAt: CREDENTIAL.expiresAt,
      order: 7,
    });
  });
});

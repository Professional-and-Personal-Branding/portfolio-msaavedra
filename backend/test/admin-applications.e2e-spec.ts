/**
 * E2E — change `add-application-tracking`: API del panel de postulaciones
 * (`/api/admin/applications`). Crea sus perfiles y enlaces de prueba (prefijo `apps-e2e`), inserta
 * las visitas directo con Prisma con el `kind` que cada caso necesita y lo borra todo al final.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';
import { createE2eAdmin, createTestApp, deleteE2eAdmin, login } from './e2e-helpers';

const SLUG = 'apps-e2e-perfil';
const OTHER = 'apps-e2e-otro';
const BORRAR = 'apps-e2e-borrar';
const SLUGS = [SLUG, OTHER, BORRAR];
const COMPANY_PREFIX = 'E2E Apps';
/** Las del prefijo y la de la fórmula del caso del CSV. */
const OWN_APPLICATIONS = { OR: [{ company: { startsWith: COMPANY_PREFIX } }, { company: '=1+1' }] };

interface LinkBody {
  id: string;
  code: string;
  label: string;
}

interface ApplicationBody {
  id: string;
  company: string;
  role: string;
  jobUrl: string | null;
  portal: string | null;
  notes: string | null;
  status: string;
  appliedAt: string | null;
  statusChangedAt: string;
  curatedProfileId: string | null;
  profileSlug: string | null;
  nextStatuses: string[];
  shareLink: {
    id: string;
    label: string;
    code: string;
    revoked: boolean;
    opens: number;
    firstOpenedAt: string | null;
    lastOpenedAt: string | null;
  } | null;
}

describe('Postulaciones: API del panel (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bearer: string;
  let profileId: string;
  let otherId: string;

  const server = () => app.getHttpServer();
  const auth = () => ({ Authorization: `Bearer ${bearer}` });
  const apps = '/api/admin/applications';
  const body = (over: Record<string, unknown> = {}) => ({
    company: `${COMPANY_PREFIX} Globex`,
    role: 'Backend Senior',
    ...over,
  });

  async function createProfile(slug: string): Promise<string> {
    const res = await request(server())
      .post('/api/admin/curated-profiles')
      .set(auth())
      .send({
        slug,
        title: { es: slug, en: slug },
        headline: { es: 'Titular', en: 'Headline' },
        filterTags: [],
      });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  async function createLink(id: string, label = 'Enlace'): Promise<LinkBody> {
    const res = await request(server())
      .post(`/api/admin/curated-profiles/${id}/share-links`)
      .set(auth())
      .send({ label });
    expect(res.status).toBe(201);
    return res.body as LinkBody;
  }

  const create = (over: Record<string, unknown> = {}) =>
    request(server()).post(apps).set(auth()).send(body(over));

  async function created(over: Record<string, unknown> = {}): Promise<ApplicationBody> {
    const res = await create(over);
    expect(res.status).toBe(201);
    return res.body as ApplicationBody;
  }

  const wipe = async () => {
    await prisma.application.deleteMany({ where: OWN_APPLICATIONS });
    await prisma.curatedProfile.deleteMany({ where: { slug: { in: SLUGS } } });
  };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await wipe();
    await createE2eAdmin(prisma);
    bearer = await login(app);
    profileId = await createProfile(SLUG);
    otherId = await createProfile(OTHER);
  });

  afterAll(async () => {
    await wipe();
    await deleteE2eAdmin(prisma);
    await app.close();
  });

  afterEach(async () => {
    await prisma.application.deleteMany({ where: OWN_APPLICATIONS });
  });

  describe('6.1 CRUD y filtro', () => {
    it('crea (201) con el portal normalizado y lo lee', async () => {
      const res = await create({
        portal: 'LinkedIn',
        jobUrl: 'https://globex.example/jobs/1',
        notes: 'Primer contacto',
      });
      expect(res.status).toBe(201);
      const made = res.body as ApplicationBody;
      expect(made).toMatchObject({
        company: `${COMPANY_PREFIX} Globex`,
        role: 'Backend Senior',
        portal: 'linkedin',
        status: 'DRAFT',
        appliedAt: null,
        shareLink: null,
        curatedProfileId: null,
      });
      expect(made.id).toBeTruthy();
      const read = await request(server()).get(`${apps}/${made.id}`).set(auth()).expect(200);
      expect(read.body).toEqual(made);
    });

    it('PATCH parcial cambia solo lo enviado', async () => {
      const made = await created({ notes: 'a', jobUrl: 'https://globex.example/1' });
      const res = await request(server())
        .patch(`${apps}/${made.id}`)
        .set(auth())
        .send({ notes: 'b', jobUrl: null });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        notes: 'b',
        jobUrl: null,
        company: made.company,
        role: made.role,
      });
    });

    it('lista con status=APPLIED,INTERVIEWING ordenada por updatedAt descendente', async () => {
      const first = await created({ company: `${COMPANY_PREFIX} A`, status: 'APPLIED' });
      const second = await created({ company: `${COMPANY_PREFIX} B`, status: 'INTERVIEWING' });
      await created({ company: `${COMPANY_PREFIX} C`, status: 'REJECTED' });
      await created({ company: `${COMPANY_PREFIX} D`, status: 'DRAFT' });
      // El primero se edita último: pasa a ser el más reciente.
      await request(server())
        .patch(`${apps}/${first.id}`)
        .set(auth())
        .send({ notes: 'tocada' })
        .expect(200);

      const res = await request(server())
        .get(`${apps}?status=APPLIED,INTERVIEWING`)
        .set(auth())
        .expect(200);
      const mine = (res.body as ApplicationBody[]).filter((a) =>
        a.company.startsWith(COMPANY_PREFIX),
      );
      expect(mine.map((a) => a.id)).toEqual([first.id, second.id]);
      expect(mine.every((a) => ['APPLIED', 'INTERVIEWING'].includes(a.status))).toBe(true);
    });

    it('sin status trae todas', async () => {
      await created({ status: 'APPLIED' });
      await created({ status: 'REJECTED' });
      const res = await request(server()).get(apps).set(auth()).expect(200);
      const mine = (res.body as ApplicationBody[]).filter((a) =>
        a.company.startsWith(COMPANY_PREFIX),
      );
      expect(mine).toHaveLength(2);
    });

    it('borra (204) y después la lectura da 404; borrar de nuevo, 404', async () => {
      const made = await created();
      await request(server()).delete(`${apps}/${made.id}`).set(auth()).expect(204);
      await request(server()).get(`${apps}/${made.id}`).set(auth()).expect(404);
      await request(server()).delete(`${apps}/${made.id}`).set(auth()).expect(404);
    });

    it('un id inexistente da 404 al leer y al editar', async () => {
      await request(server()).get(`${apps}/nope`).set(auth()).expect(404);
      await request(server()).patch(`${apps}/nope`).set(auth()).send({ notes: 'x' }).expect(404);
    });

    it('status=HIRED en la lista y en el export da 400', async () => {
      await request(server()).get(`${apps}?status=HIRED`).set(auth()).expect(400);
      await request(server()).get(`${apps}?status=APPLIED,HIRED`).set(auth()).expect(400);
      await request(server()).get(`${apps}/export?status=HIRED`).set(auth()).expect(400);
    });

    it('un campo desconocido (contactEmail) da 400 y no crea nada', async () => {
      const before = await prisma.application.count();
      const res = await create({ contactEmail: 'rrhh@globex.example' });
      expect(res.status).toBe(400);
      expect(await prisma.application.count()).toBe(before);
    });

    it('campos inválidos dan 400: empresa vacía, ftp, portal con espacios, status inexistente', async () => {
      expect((await create({ company: '   ' })).status).toBe(400);
      expect((await create({ jobUrl: 'ftp://x' })).status).toBe(400);
      expect((await create({ portal: 'mi portal!' })).status).toBe(400);
      expect((await create({ status: 'HIRED' })).status).toBe(400);
      expect((await create({ company: 'x'.repeat(121) })).status).toBe(400);
    });

    it('las siete rutas dan 401 sin sesión', async () => {
      // De a una, no con Promise.all: cada request() abre su propio servidor efímero y el guard
      // responde 401 sin leer el cuerpo del POST/PATCH; en paralelo, el runner de CI llegó a
      // cortar una conexión a mitad del envío (ECONNRESET) aunque la API respondiera bien.
      const calls = [
        () => request(server()).get(apps),
        () => request(server()).get(`${apps}/summary`),
        () => request(server()).get(`${apps}/export`),
        () => request(server()).post(apps).send(body()),
        () => request(server()).get(`${apps}/abc`),
        () => request(server()).patch(`${apps}/abc`).send({ notes: 'x' }),
        () => request(server()).delete(`${apps}/abc`),
      ];
      const statuses: number[] = [];
      for (const call of calls) statuses.push((await call()).status);
      expect(statuses).toEqual([401, 401, 401, 401, 401, 401, 401]);
    });
  });

  describe('6.2 Transiciones', () => {
    const patch = (id: string, send: Record<string, unknown>) =>
      request(server()).patch(`${apps}/${id}`).set(auth()).send(send);

    it('APPLIED → INTERVIEWING da 200 con nextStatuses y statusChangedAt nuevo', async () => {
      const made = await created({ status: 'APPLIED' });
      expect(made.nextStatuses).toEqual(['INTERVIEWING', 'OFFER', 'REJECTED', 'WITHDRAWN']);
      const res = await patch(made.id, { status: 'INTERVIEWING' });
      expect(res.status).toBe(200);
      const moved = res.body as ApplicationBody;
      expect(moved.status).toBe('INTERVIEWING');
      expect(moved.nextStatuses).toEqual(['OFFER', 'REJECTED', 'WITHDRAWN']);
      expect(new Date(moved.statusChangedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(made.statusChangedAt).getTime(),
      );
    });

    it('DRAFT → OFFER da 422 con error "Unprocessable Entity" y sin stack', async () => {
      const made = await created();
      const res = await patch(made.id, { status: 'OFFER' });
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        statusCode: 422,
        error: 'Unprocessable Entity',
        message: 'Transición de estado inválida: DRAFT → OFFER',
      });
      expect(res.body).not.toHaveProperty('stack');
      expect(JSON.stringify(res.body)).not.toMatch(/\bat \w+.*\(.*:\d+:\d+\)/);
    });

    it('ACCEPTED → APPLIED da 422 (estado final)', async () => {
      const made = await created({ status: 'ACCEPTED' });
      expect(made.nextStatuses).toEqual([]);
      const res = await patch(made.id, { status: 'APPLIED' });
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ error: 'Unprocessable Entity' });
    });

    it('PATCH con notas y una transición inválida da 422 y las notas no cambian', async () => {
      const made = await created({ notes: 'original' });
      const res = await patch(made.id, { notes: 'cambiada', status: 'OFFER' });
      expect(res.status).toBe(422);
      const row = await prisma.application.findUniqueOrThrow({ where: { id: made.id } });
      expect(row.notes).toBe('original');
      expect(row.status).toBe('DRAFT');
    });

    it('el mismo estado da 200 y no cambia statusChangedAt', async () => {
      const made = await created({ status: 'APPLIED' });
      const res = await patch(made.id, { status: 'APPLIED', notes: 'x' });
      expect(res.status).toBe(200);
      expect((res.body as ApplicationBody).statusChangedAt).toBe(made.statusChangedAt);
    });

    it('salir de DRAFT fija appliedAt con la fecha UTC de hoy', async () => {
      const made = await created();
      expect(made.appliedAt).toBeNull();
      const res = await patch(made.id, { status: 'APPLIED' });
      expect(res.status).toBe(200);
      expect((res.body as ApplicationBody).appliedAt).toBe(new Date().toISOString().slice(0, 10));
    });

    it('REJECTED → APPLIED conserva appliedAt', async () => {
      const made = await created({ status: 'REJECTED', appliedAt: '2026-01-15' });
      expect(made.appliedAt).toBe('2026-01-15');
      const res = await patch(made.id, { status: 'APPLIED' });
      expect(res.status).toBe(200);
      expect((res.body as ApplicationBody).appliedAt).toBe('2026-01-15');
    });

    it('DRAFT con appliedAt da 400; una fecha futura, también', async () => {
      expect((await create({ appliedAt: '2026-01-15' })).status).toBe(400);
      expect((await create({ status: 'APPLIED', appliedAt: '2999-01-01' })).status).toBe(400);
      expect((await create({ status: 'APPLIED', appliedAt: '15/01/2026' })).status).toBe(400);
    });

    it('un status desconocido en el PATCH da 400, no 422', async () => {
      const made = await created();
      const res = await patch(made.id, { status: 'HIRED' });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: 'Bad Request' });
    });
  });

  describe('6.3 Vínculos y aperturas', () => {
    it('crea con perfil y enlace MANUAL: trae el slug y la etiqueta', async () => {
      const link = await createLink(profileId, 'Globex — RR. HH.');
      const res = await create({ curatedProfileId: profileId, shareLinkId: link.id });
      expect(res.status).toBe(201);
      const made = res.body as ApplicationBody;
      expect(made.profileSlug).toBe(SLUG);
      expect(made.shareLink).toMatchObject({
        id: link.id,
        label: 'Globex — RR. HH.',
        revoked: false,
        opens: 0,
        firstOpenedAt: null,
        lastOpenedAt: null,
      });
    });

    it('perfil inexistente, enlace de otro perfil, LINKEDIN_POST o sin perfil: 400 sin crear', async () => {
      const foreign = await createLink(otherId, 'Ajeno');
      const own = await createLink(profileId, 'Propio');
      const linkedin = await request(server())
        .post(`/api/admin/curated-profiles/${profileId}/share-links/linkedin`)
        .set(auth())
        .send();
      expect([200, 201]).toContain(linkedin.status);
      const before = await prisma.application.count();

      expect((await create({ curatedProfileId: 'no-existe' })).status).toBe(400);
      expect((await create({ curatedProfileId: profileId, shareLinkId: foreign.id })).status).toBe(
        400,
      );
      expect(
        (
          await create({
            curatedProfileId: profileId,
            shareLinkId: (linkedin.body as LinkBody).id,
          })
        ).status,
      ).toBe(400);
      expect((await create({ shareLinkId: own.id })).status).toBe(400);
      expect((await create({ curatedProfileId: profileId, shareLinkId: 'no-existe' })).status).toBe(
        400,
      );
      expect(await prisma.application.count()).toBe(before);
    });

    it('el segundo uso del mismo enlace da 409', async () => {
      const link = await createLink(profileId, 'Único');
      await created({ curatedProfileId: profileId, shareLinkId: link.id });
      const res = await create({
        company: `${COMPANY_PREFIX} Otra`,
        curatedProfileId: profileId,
        shareLinkId: link.id,
      });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: 'Conflict' });
    });

    it('un PATCH con el enlace de otra postulación da 409; con el propio, 200', async () => {
      const taken = await createLink(profileId, 'Tomado');
      await created({ curatedProfileId: profileId, shareLinkId: taken.id });
      const mine = await created({ company: `${COMPANY_PREFIX} Mía`, curatedProfileId: profileId });
      const clash = await request(server())
        .patch(`${apps}/${mine.id}`)
        .set(auth())
        .send({ shareLinkId: taken.id });
      expect(clash.status).toBe(409);
      const free = await createLink(profileId, 'Libre');
      await request(server())
        .patch(`${apps}/${mine.id}`)
        .set(auth())
        .send({ shareLinkId: free.id })
        .expect(200);
      await request(server())
        .patch(`${apps}/${mine.id}`)
        .set(auth())
        .send({ shareLinkId: free.id, notes: 'de nuevo' })
        .expect(200);
    });

    it('quitar el perfil sin quitar el enlace da 400', async () => {
      const link = await createLink(profileId, 'Atado');
      const made = await created({ curatedProfileId: profileId, shareLinkId: link.id });
      await request(server())
        .patch(`${apps}/${made.id}`)
        .set(auth())
        .send({ curatedProfileId: null })
        .expect(400);
    });

    it('un enlace revocado se acepta y sigue mostrando sus aperturas', async () => {
      const link = await createLink(profileId, 'Revocado');
      await request(server())
        .post(`/api/admin/curated-profiles/${profileId}/share-links/${link.id}/revoke`)
        .set(auth())
        .expect(200);
      const res = await create({ curatedProfileId: profileId, shareLinkId: link.id });
      expect(res.status).toBe(201);
      expect((res.body as ApplicationBody).shareLink?.revoked).toBe(true);
    });

    it('cuenta solo las visitas HUMAN: OWNER día 1, HUMAN días 3 y 5, BOT', async () => {
      const link = await createLink(profileId, 'Aperturas');
      const day = (n: number) => new Date(`2026-10-0${n}T12:00:00.000Z`);
      const view = (kind: 'OWNER' | 'HUMAN' | 'BOT', viewedAt: Date) => ({
        curatedProfileId: profileId,
        shareLinkId: link.id,
        kind,
        viewedAt,
      });
      await prisma.profileView.createMany({
        data: [
          view('OWNER', day(1)),
          view('HUMAN', day(3)),
          view('HUMAN', day(5)),
          view('BOT', day(7)),
        ],
      });
      const made = await created({ curatedProfileId: profileId, shareLinkId: link.id });
      const read = await request(server()).get(`${apps}/${made.id}`).set(auth()).expect(200);
      expect((read.body as ApplicationBody).shareLink).toMatchObject({
        opens: 2,
        firstOpenedAt: day(3).toISOString(),
        lastOpenedAt: day(5).toISOString(),
      });
      const list = await request(server()).get(apps).set(auth()).expect(200);
      const found = (list.body as ApplicationBody[]).find((a) => a.id === made.id);
      expect(found?.shareLink).toMatchObject({ opens: 2, firstOpenedAt: day(3).toISOString() });
    });

    it('borrar el perfil deja la postulación sin perfil ni enlace (SetNull)', async () => {
      const doomed = await createProfile(BORRAR);
      const link = await createLink(doomed, 'Se va');
      const made = await created({ curatedProfileId: doomed, shareLinkId: link.id });
      await request(server()).delete(`/api/admin/curated-profiles/${doomed}`).set(auth());
      const read = await request(server()).get(`${apps}/${made.id}`).set(auth()).expect(200);
      expect(read.body).toMatchObject({
        curatedProfileId: null,
        profileSlug: null,
        shareLink: null,
      });
    });
  });

  describe('6.4 Resumen y CSV', () => {
    it('summary trae los siete estados con ceros y active', async () => {
      await prisma.application.deleteMany();
      await created({ company: `${COMPANY_PREFIX} 1`, status: 'APPLIED' });
      await created({ company: `${COMPANY_PREFIX} 2`, status: 'APPLIED' });
      await created({ company: `${COMPANY_PREFIX} 3`, status: 'OFFER' });
      await created({ company: `${COMPANY_PREFIX} 4`, status: 'REJECTED' });
      const res = await request(server()).get(`${apps}/summary`).set(auth()).expect(200);
      expect(res.body).toEqual({
        byStatus: {
          DRAFT: 0,
          APPLIED: 2,
          INTERVIEWING: 0,
          OFFER: 1,
          ACCEPTED: 0,
          REJECTED: 1,
          WITHDRAWN: 0,
        },
        active: 3,
      });
    });

    it('export: cabeceras exactas, BOM y una empresa con fórmula neutralizada', async () => {
      await prisma.application.deleteMany();
      await created({ company: `${COMPANY_PREFIX} ok`, role: 'Dev', status: 'APPLIED' });
      await created({ company: '=1+1', role: 'Dev', status: 'APPLIED' });
      const res = await request(server())
        .get(`${apps}/export`)
        .set(auth())
        .buffer(true)
        .parse((response, callback) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(res.headers['content-disposition']).toBe(
        `attachment; filename="postulaciones-${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      expect(res.headers['cache-control']).toBe('no-store');
      const raw = res.body as Buffer;
      expect([raw[0], raw[1], raw[2]]).toEqual([0xef, 0xbb, 0xbf]);
      const text = raw.toString('utf8');
      expect(text.startsWith('﻿"Empresa","Puesto","Estado"')).toBe(true);
      expect(text).toContain('"\'=1+1"');
      expect(text.split('\r\n')).toHaveLength(3);
    });

    it('export aplica el filtro de estado', async () => {
      await prisma.application.deleteMany();
      await created({ company: `${COMPANY_PREFIX} abierta`, status: 'APPLIED' });
      await created({ company: `${COMPANY_PREFIX} cerrada`, status: 'REJECTED' });
      const res = await request(server()).get(`${apps}/export?status=REJECTED`).set(auth());
      expect(res.status).toBe(200);
      expect(res.text).toContain(`${COMPANY_PREFIX} cerrada`);
      expect(res.text).not.toContain(`${COMPANY_PREFIX} abierta`);
    });

    it('export sin sesión da 401 JSON, no un CSV', async () => {
      const res = await request(server()).get(`${apps}/export`);
      expect(res.status).toBe(401);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.headers['content-disposition']).toBeUndefined();
    });
  });

  describe('6.5 Sin rutas públicas', () => {
    it('GET /api/applications y /api/applications/export dan 404', async () => {
      await request(server()).get('/api/applications').expect(404);
      await request(server()).get('/api/applications/export').expect(404);
    });

    it('el perfil público es idéntico antes y después de crear postulaciones', async () => {
      const before = await request(server()).get(`/api/curated-profiles/${SLUG}`).expect(200);
      const link = await createLink(profileId, 'Publico');
      await created({ curatedProfileId: profileId, shareLinkId: link.id, notes: 'secreta' });
      const after = await request(server()).get(`/api/curated-profiles/${SLUG}`).expect(200);
      expect(after.body).toEqual(before.body);
      expect(JSON.stringify(after.body)).not.toContain('secreta');
    });

    it('el sitemap no cambia con postulaciones', async () => {
      const before = await request(server()).get('/sitemap.xml').expect(200);
      await created({ curatedProfileId: profileId, status: 'APPLIED' });
      const after = await request(server()).get('/sitemap.xml').expect(200);
      expect(after.text).toBe(before.text);
    });
  });
});

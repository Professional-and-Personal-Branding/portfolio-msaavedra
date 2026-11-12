/**
 * E2E — spec `featured-repositories` (change `add-featured-repositories`). Requiere Postgres
 * arriba y la base migrada + seedeada con `docs/cv-data.json` (0 repositorios). Todo lo que
 * crea lo borra.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';
import { createE2eAdmin, createTestApp, deleteE2eAdmin, login } from './e2e-helpers';

const MARK = 'E2E repo';

interface AdminRepository {
  id: string;
  name: string;
  url: string;
  language: string | null;
  description: { es: string; en?: string };
  technologies: string[];
  tags: string[];
  order: number;
  visible: boolean;
}

interface PublicRepository {
  id: string;
  description: string;
  [key: string]: unknown;
}

const BODY = {
  name: `${MARK} reservas-api`,
  url: 'https://github.com/e2e-org/reservas-api',
  language: 'Java',
  description: { es: 'API de reservas', en: 'Booking API' },
  technologies: ['Spring Boot'],
  tags: ['java'],
  order: 1,
};

describe('Repositorios destacados (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);
  const http = () => request(app.getHttpServer());
  const adminList = async () =>
    (await auth(http().get('/api/admin/featured-repositories')).expect(200))
      .body as AdminRepository[];

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await createE2eAdmin(prisma);
    token = await login(app);
  });

  afterAll(async () => {
    await prisma.featuredRepository.deleteMany({ where: { url: { contains: '/e2e-org/' } } });
    await deleteE2eAdmin(prisma);
    await app.close();
  });

  it('tras el seed de cv-data.json, el listado público y el del panel están vacíos', async () => {
    const pub = await http().get('/api/featured-repositories').expect(200);
    expect(pub.body).toEqual([]);
    expect(await adminList()).toEqual([]);
  });

  it('sin sesión → 401 en todas las rutas del panel', async () => {
    await http().get('/api/admin/featured-repositories').expect(401);
    await http().post('/api/admin/featured-repositories').send(BODY).expect(401);
    await http().get('/api/admin/featured-repositories/x').expect(401);
    await http().patch('/api/admin/featured-repositories/x').send({ name: 'a' }).expect(401);
    await http().delete('/api/admin/featured-repositories/x').expect(401);
  });

  describe('validación del alta', () => {
    it('stars es un campo desconocido → 400', async () => {
      await auth(http().post('/api/admin/featured-repositories'))
        .send({ ...BODY, stars: 10 })
        .expect(400);
      expect(await adminList()).toEqual([]);
    });

    it.each([
      'https://gitlab.com/e2e-org/reservas-api',
      'https://github.com/e2e-org/reservas-api/',
      'https://github.com/e2e-org/reservas-api.git',
      'https://github.com/e2e-org/reservas-api?tab=readme',
      'http://github.com/e2e-org/reservas-api',
    ])('URL %s → 400 con la forma esperada', async (url) => {
      const res = await auth(http().post('/api/admin/featured-repositories'))
        .send({ ...BODY, url })
        .expect(400);
      expect(JSON.stringify(res.body)).toContain('https://github.com/<usuario>/<repositorio>');
      expect(await adminList()).toEqual([]);
    });

    it('nombre vacío → 400 nombrando name', async () => {
      const res = await auth(http().post('/api/admin/featured-repositories'))
        .send({ ...BODY, name: '   ' })
        .expect(400);
      expect(JSON.stringify(res.body)).toContain('name');
    });

    it('sin descripción → 400', async () => {
      const { description: _d, ...sinDescripcion } = BODY;
      await auth(http().post('/api/admin/featured-repositories')).send(sinDescripcion).expect(400);
    });
  });

  describe('ciclo de vida', () => {
    let id: string;

    it('POST válido → 201 y aparece en el panel y en el listado público (en inglés)', async () => {
      const created = await auth(http().post('/api/admin/featured-repositories'))
        .send(BODY)
        .expect(201);
      const body = created.body as AdminRepository;
      id = body.id;
      expect(body).toMatchObject({ ...BODY, visible: true });
      expect('stars' in body).toBe(false);

      expect((await adminList()).map((r) => r.id)).toContain(id);

      const pub = await http().get('/api/featured-repositories?locale=en').expect(200);
      expect(pub.headers['content-language']).toBe('en');
      const found = (pub.body as PublicRepository[]).find((r) => r.id === id);
      expect(found).toBeDefined();
      expect(found?.description).toBe('Booking API');
      expect('visible' in (found ?? {})).toBe(false);
      expect('stars' in (found ?? {})).toBe(false);
    });

    it('la URL se recorta en los bordes', async () => {
      const res = await auth(http().post('/api/admin/featured-repositories'))
        .send({
          ...BODY,
          name: `${MARK} recortado`,
          url: '  https://github.com/e2e-org/recortado ',
        })
        .expect(201);
      expect((res.body as AdminRepository).url).toBe('https://github.com/e2e-org/recortado');
    });

    it('un duplicado con otras mayúsculas → 409 y la cantidad no cambia', async () => {
      const before = (await adminList()).length;
      await auth(http().post('/api/admin/featured-repositories'))
        .send({ ...BODY, url: 'https://github.com/E2E-Org/Reservas-API' })
        .expect(409);
      expect(await adminList()).toHaveLength(before);
    });

    it('PATCH solo de name → 200 sin chocar con su propia URL', async () => {
      const res = await auth(http().patch(`/api/admin/featured-repositories/${id}`))
        .send({ name: `${MARK} renombrado` })
        .expect(200);
      expect((res.body as AdminRepository).name).toBe(`${MARK} renombrado`);
    });

    it('PATCH con la URL de otro registro → 409', async () => {
      await auth(http().patch(`/api/admin/featured-repositories/${id}`))
        .send({ url: 'https://github.com/e2e-org/recortado' })
        .expect(409);
    });

    it('PATCH con una URL inválida → 400', async () => {
      await auth(http().patch(`/api/admin/featured-repositories/${id}`))
        .send({ url: 'https://gitlab.com/e2e-org/x' })
        .expect(400);
    });

    it('PATCH visible:false → sale del listado público y sigue en el del panel', async () => {
      await auth(http().patch(`/api/admin/featured-repositories/${id}`))
        .send({ visible: false })
        .expect(200);
      const pub = (await http().get('/api/featured-repositories').expect(200))
        .body as PublicRepository[];
      expect(pub.map((r) => r.id)).not.toContain(id);
      const row = (await adminList()).find((r) => r.id === id);
      expect(row?.visible).toBe(false);
    });

    it('DELETE → 204 y el detalle responde 404', async () => {
      await auth(http().delete(`/api/admin/featured-repositories/${id}`)).expect(204);
      await auth(http().get(`/api/admin/featured-repositories/${id}`)).expect(404);
      await auth(http().delete(`/api/admin/featured-repositories/${id}`)).expect(404);
    });
  });
});

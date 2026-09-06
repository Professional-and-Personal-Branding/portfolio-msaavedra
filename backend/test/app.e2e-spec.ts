/**
 * E2E — cubre los escenarios de los 5 specs del change `add-backend-base`.
 * Requiere Postgres arriba (docker compose) y la base migrada + seedeada.
 * Las aserciones de contenido se derivan de docs/cv-data.json en runtime.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GLOBAL_PREFIX } from '../src/app.constants';
import { buildCorsOptions } from '../src/shared/infrastructure/http/cors.options';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';
import { setupSwagger } from '../src/swagger';

interface Localized {
  es: string;
  en: string;
}
interface CvData {
  profile: {
    fullName: string;
    yearsOfExperience: number;
    availability: { startDate: Localized };
    languages: { name: string; nameI18n: Localized }[];
  };
  experiences: { company: string; role: Localized; highlights: { es: string[]; en: string[] } }[];
}

const FRONTEND_URL = 'http://localhost:5173';

function hasLocalizedObject(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasLocalizedObject);
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value);
    if (keys.includes('es') || keys.includes('en')) return true;
    return Object.values(value as Record<string, unknown>).some(hasLocalizedObject);
  }
  return false;
}

describe('API pública (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cv: CvData;

  beforeAll(async () => {
    process.env.FRONTEND_URL = FRONTEND_URL;
    cv = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../docs/cv-data.json'), 'utf-8'),
    ) as CvData;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(GLOBAL_PREFIX);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.enableCors(buildCorsOptions(FRONTEND_URL));
    setupSwagger(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── api-platform ────────────────────────────────────────────────────────
  describe('api-platform', () => {
    it('ruta con prefijo responde 200 JSON', async () => {
      const res = await request(app.getHttpServer()).get('/api/profile');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/json/);
    });

    it('ruta sin prefijo → 404 JSON', async () => {
      const res = await request(app.getHttpServer()).get('/profile');
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ statusCode: 404, error: 'Not Found' });
    });

    it('errores en formato consistente y sin stack', async () => {
      const res = await request(app.getHttpServer()).get('/api/experiences/no-existe');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        statusCode: 404,
        message: expect.any(String) as string,
        error: 'Not Found',
      });
      expect(res.body).not.toHaveProperty('stack');
    });

    it('CORS: origen permitido recibe Access-Control-Allow-Origin', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/profile')
        .set('Origin', FRONTEND_URL);
      expect(res.headers['access-control-allow-origin']).toBe(FRONTEND_URL);
    });

    it('CORS: origen no permitido no recibe el header', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/profile')
        .set('Origin', 'https://evil.example');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('Swagger UI accesible en /api/docs', async () => {
      const res = await request(app.getHttpServer()).get('/api/docs');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/html/);
    });

    it('OpenAPI JSON contiene todas las rutas y documenta `locale` con enum es/en', async () => {
      const res = await request(app.getHttpServer()).get('/api/docs-json');
      expect(res.status).toBe(200);
      const paths = res.body.paths as Record<
        string,
        Record<string, { parameters?: { name: string; schema?: { enum?: string[] } }[] }>
      >;
      for (const route of ['/api/profile', '/api/experiences', '/api/experiences/{id}']) {
        expect(paths).toHaveProperty(route);
        const locale = paths[route].get.parameters?.find((p) => p.name === 'locale');
        expect(locale).toBeDefined();
        expect(locale?.schema?.enum).toEqual(['es', 'en']);
      }
    });
  });

  // ─── content-localization ────────────────────────────────────────────────
  describe('content-localization', () => {
    const startDate = (locale: 'es' | 'en') => cv.profile.availability.startDate[locale];

    it('query locale explícito', async () => {
      const res = await request(app.getHttpServer()).get('/api/profile?locale=en');
      expect(res.body.availability.startDate).toBe(startDate('en'));
    });

    it('query lang como alias', async () => {
      const res = await request(app.getHttpServer()).get('/api/profile?lang=en');
      expect(res.body.availability.startDate).toBe(startDate('en'));
    });

    it('precedencia de locale sobre lang', async () => {
      const res = await request(app.getHttpServer()).get('/api/profile?locale=es&lang=en');
      expect(res.body.availability.startDate).toBe(startDate('es'));
    });

    it('header Accept-Language', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/experiences')
        .set('Accept-Language', 'en-US,en;q=0.9,es;q=0.8');
      expect(res.body[0].role).toBe(cv.experiences[0].role.en);
    });

    it('sin indicación de idioma → español', async () => {
      const res = await request(app.getHttpServer()).get('/api/experiences');
      expect(res.body[0].role).toBe(cv.experiences[0].role.es);
    });

    it('locale no soportado cae al default con 200', async () => {
      const res = await request(app.getHttpServer()).get('/api/profile?locale=fr');
      expect(res.status).toBe(200);
      expect(res.body.availability.startDate).toBe(startDate('es'));
      expect(res.headers['content-language']).toBe('es');
    });

    it('normalización de variantes regionales', async () => {
      const res = await request(app.getHttpServer()).get('/api/profile?locale=EN-us');
      expect(res.body.availability.startDate).toBe(startDate('en'));
      expect(res.headers['content-language']).toBe('en');
    });

    it('respuestas con texto ya resuelto (sin objetos {es,en})', async () => {
      const res = await request(app.getHttpServer()).get('/api/experiences?locale=en');
      expect(hasLocalizedObject(res.body)).toBe(false);
      for (const item of res.body as Record<string, unknown>[]) {
        expect(typeof item.role).toBe('string');
        expect(typeof item.summary).toBe('string');
        expect(Array.isArray(item.highlights)).toBe(true);
      }
    });
  });

  // ─── public-profile-api ──────────────────────────────────────────────────
  describe('public-profile-api', () => {
    it('perfil en español (default)', async () => {
      const res = await request(app.getHttpServer()).get('/api/profile');
      expect(res.status).toBe(200);
      expect(res.body.fullName).toBe(cv.profile.fullName);
      expect(res.body.yearsOfExperience).toBe(cv.profile.yearsOfExperience);
      expect(res.body.languages).toHaveLength(cv.profile.languages.length);
      expect(res.body.languages[0].name).toBe(cv.profile.languages[0].nameI18n.es);
    });

    it('perfil en inglés', async () => {
      const res = await request(app.getHttpServer()).get('/api/profile?locale=en');
      expect(res.body.availability.startDate).toBe(cv.profile.availability.startDate.en);
      expect(res.body.languages[0].name).toBe(cv.profile.languages[0].nameI18n.en);
    });

    it('sin objetos localizados ni metadatos de persistencia', async () => {
      const res = await request(app.getHttpServer()).get('/api/profile');
      expect(hasLocalizedObject(res.body)).toBe(false);
      expect(res.body).not.toHaveProperty('createdAt');
      expect(res.body).not.toHaveProperty('updatedAt');
      for (const lang of res.body.languages as Record<string, unknown>[]) {
        expect(lang).not.toHaveProperty('profileId');
      }
    });

    it('base sin perfil → 404', async () => {
      const record = await prisma.profile.findFirstOrThrow({ include: { languages: true } });
      await prisma.profile.delete({ where: { id: record.id } }); // cascade borra languages
      try {
        const res = await request(app.getHttpServer()).get('/api/profile');
        expect(res.status).toBe(404);
        expect(res.body).toMatchObject({ statusCode: 404, error: 'Not Found' });
        expect(res.body.message).toMatch(/Perfil/);
      } finally {
        const { languages, ...profile } = record;
        await prisma.profile.create({
          data: {
            ...profile,
            headline: profile.headline ?? {},
            summary: profile.summary ?? {},
            availModality: profile.availModality ?? undefined,
            availContractType: profile.availContractType ?? undefined,
            availStartDate: profile.availStartDate ?? undefined,
            languages: {
              create: languages.map(({ profileId: _p, ...l }) => ({
                ...l,
                nameI18n: l.nameI18n ?? undefined,
                detail: l.detail ?? undefined,
              })),
            },
          },
        });
      }
    });
  });

  // ─── public-experience-api ───────────────────────────────────────────────
  describe('public-experience-api', () => {
    it('listado tras el seed: conteo del JSON, primero Novacomp con order 0', async () => {
      const res = await request(app.getHttpServer()).get('/api/experiences');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(cv.experiences.length);
      expect(res.body[0]).toMatchObject({ company: cv.experiences[0].company, order: 0 });
      for (const item of res.body as Record<string, unknown>[]) {
        for (const key of [
          'id',
          'company',
          'role',
          'startDate',
          'current',
          'location',
          'sector',
          'summary',
          'highlights',
          'technologies',
          'tags',
          'order',
        ]) {
          expect(item).toHaveProperty(key);
        }
        expect(item).toHaveProperty('endDate');
      }
    });

    it('listado en inglés', async () => {
      const res = await request(app.getHttpServer()).get('/api/experiences?locale=en');
      expect(res.body[0].role).toBe(cv.experiences[0].role.en);
      expect(res.body[0].highlights).toEqual(cv.experiences[0].highlights.en);
    });

    it('orden cronológico: startDate descendente y order ascendente a igual startDate', async () => {
      const res = await request(app.getHttpServer()).get('/api/experiences');
      const items = res.body as { order: number; startDate: string }[];
      for (let i = 1; i < items.length; i++) {
        const prev = items[i - 1];
        const curr = items[i];
        const okOrder =
          prev.startDate > curr.startDate ||
          (prev.startDate === curr.startDate && prev.order <= curr.order);
        expect(okOrder).toBe(true);
      }
    });

    it('detalle existente por id en inglés', async () => {
      const list = await request(app.getHttpServer()).get('/api/experiences');
      const id = list.body[0].id as string;
      const res = await request(app.getHttpServer()).get(`/api/experiences/${id}?locale=en`);
      expect(res.status).toBe(200);
      expect(res.body.company).toBe(cv.experiences[0].company);
      expect(res.body.role).toBe(cv.experiences[0].role.en);
      expect(res.headers['content-language']).toBe('en');
    });

    it('id inexistente → 404', async () => {
      const res = await request(app.getHttpServer()).get('/api/experiences/no-existe');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });

    it('experiencia oculta: excluida del listado y 404 en detalle', async () => {
      const target = await prisma.experience.findFirstOrThrow({ orderBy: { order: 'desc' } });
      await prisma.experience.update({ where: { id: target.id }, data: { visible: false } });
      try {
        const list = await request(app.getHttpServer()).get('/api/experiences');
        expect(list.body).toHaveLength(cv.experiences.length - 1);
        expect((list.body as { id: string }[]).some((e) => e.id === target.id)).toBe(false);

        const detail = await request(app.getHttpServer()).get(`/api/experiences/${target.id}`);
        expect(detail.status).toBe(404);
      } finally {
        await prisma.experience.update({ where: { id: target.id }, data: { visible: true } });
      }
    });

    it('sin metadatos de persistencia ni `visible`', async () => {
      const res = await request(app.getHttpServer()).get('/api/experiences');
      for (const item of res.body as Record<string, unknown>[]) {
        expect(item).not.toHaveProperty('createdAt');
        expect(item).not.toHaveProperty('updatedAt');
        expect(item).not.toHaveProperty('visible');
      }
    });
  });
});

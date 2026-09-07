/**
 * E2E — spec `public-portfolio-sections-api` + delta de `curated-profile-resolution`
 * (proyectos por tags, secciones informativas, forma completa).
 */
import { INestApplication } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';
import { createTestApp } from './e2e-helpers';

interface Localized {
  es: string;
  en: string;
}
interface CvData {
  education: { degree: Localized; institution: string; inProgress: boolean }[];
  certifications: { name: Localized; issuer: string }[];
  projects: { name: string; role: Localized; tags: string[] }[];
  profile: { socialLinks: { platform: string; featured: boolean; stats?: { repos?: number } }[] };
  profileTemplates: { slug: string; filterTags: string[] }[];
}

const intersects = (a: string[], b: string[]) => b.length === 0 || a.some((t) => b.includes(t));

describe('Secciones del portafolio (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cv: CvData;
  const get = (url: string) => request(app.getHttpServer()).get(url);

  beforeAll(async () => {
    cv = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../docs/cv-data.json'), 'utf-8'),
    ) as CvData;
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/education: conteo, primero del JSON, locale en, sin visible', async () => {
    const es = await get('/api/education');
    expect(es.status).toBe(200);
    expect(es.body).toHaveLength(cv.education.length);
    expect(es.body[0].institution).toBe(cv.education[0].institution);
    expect(es.body[0].inProgress).toBe(true);
    expect(es.body[0].degree).toBe(cv.education[0].degree.es);
    expect(es.body[0]).not.toHaveProperty('visible');

    const en = await get('/api/education?locale=en');
    expect(en.body[0].degree).toBe(cv.education[0].degree.en);
    expect(en.headers['content-language']).toBe('en');
  });

  it('GET /api/certifications: conteo y issuer', async () => {
    const res = await get('/api/certifications');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(cv.certifications.length);
    expect(res.body[0].issuer).toBe(cv.certifications[0].issuer);
    expect(res.body[0].name).toBe(cv.certifications[0].name.es);
  });

  it('GET /api/projects?locale=en: conteo, role/summary en inglés, tags array', async () => {
    const res = await get('/api/projects?locale=en');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(cv.projects.length);
    expect(res.body[0].role).toBe(cv.projects[0].role.en);
    expect(typeof res.body[0].summary).toBe('string');
    expect(Array.isArray(res.body[0].tags)).toBe(true);
  });

  it('GET /api/social-links: github destacado con stats.repos, youtube no destacado', async () => {
    const res = await get('/api/social-links');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(cv.profile.socialLinks.length);
    const github = (
      res.body as { platform: string; featured: boolean; stats: { repos: number } }[]
    ).find((s) => s.platform === 'github');
    expect(github?.featured).toBe(true);
    expect(typeof github?.stats.repos).toBe('number');
    const youtube = (res.body as { platform: string; featured: boolean }[]).find(
      (s) => s.platform === 'youtube',
    );
    expect(youtube?.featured).toBe(false);
  });

  it('proyecto oculto no aparece en /api/projects ni en la vista curada (revertido)', async () => {
    const row = await prisma.project.findFirstOrThrow({ orderBy: { order: 'asc' } });
    await prisma.project.update({ where: { id: row.id }, data: { visible: false } });
    try {
      const list = await get('/api/projects');
      expect((list.body as { id: string }[]).some((p) => p.id === row.id)).toBe(false);
      const curated = await get('/api/curated-profiles/all');
      expect((curated.body.projects as { id: string }[]).some((p) => p.id === row.id)).toBe(false);
    } finally {
      await prisma.project.update({ where: { id: row.id }, data: { visible: true } });
    }
  });

  it('vista curada: proyectos por tags derivados del JSON; secciones informativas completas', async () => {
    for (const slug of ['tech-lead-dotnet', 'devops-platform', 'generalist-polyglot']) {
      const template = cv.profileTemplates.find((t) => t.slug === slug)!;
      const expected = cv.projects
        .filter((p) => intersects(p.tags, template.filterTags))
        .map((p) => p.name);
      const res = await get(`/api/curated-profiles/${slug}`);
      expect(res.status).toBe(200);
      expect((res.body.projects as { name: string }[]).map((p) => p.name).sort()).toEqual(
        expected.sort(),
      );
      expect(res.body.education).toHaveLength(cv.education.length);
      expect(res.body.certifications).toHaveLength(cv.certifications.length);
      expect(res.body.socialLinks).toHaveLength(cv.profile.socialLinks.length);
    }
  });

  it('vista curada en inglés: proyectos, educación, certificaciones y social links resueltos', async () => {
    const res = await get('/api/curated-profiles/all?locale=en');
    expect(res.body.projects[0].role).toBe(cv.projects[0].role.en);
    expect(res.body.education[0].degree).toBe(cv.education[0].degree.en);
    expect(res.body.certifications[0].name).toBe(cv.certifications[0].name.en);
    expect(typeof res.body.socialLinks[0].label).toBe('string');
    expect(JSON.stringify(res.body)).not.toMatch(/"es":/);
  });

  it('OpenAPI documenta las cuatro rutas con locale', async () => {
    const res = await get('/api/docs-json');
    const paths = res.body.paths as Record<string, { get: { parameters?: { name: string }[] } }>;
    for (const route of [
      '/api/education',
      '/api/certifications',
      '/api/projects',
      '/api/social-links',
    ]) {
      expect(paths).toHaveProperty(route);
      expect(paths[route].get.parameters?.some((p) => p.name === 'locale')).toBe(true);
    }
  });
});

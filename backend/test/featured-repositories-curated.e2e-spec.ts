/**
 * E2E — change `add-featured-repositories`: los repositorios destacados en la vista curada
 * (sección `repositories`, umbral de 2) y en el JSON Resume, contra la base real. Los repos que
 * crea llevan la cuenta `e2e-org` y se borran al final.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';
import { createE2eAdmin, createTestApp, deleteE2eAdmin, login } from './e2e-helpers';
import { validateJsonResume } from './support/json-resume-validator';

interface View {
  sections: string[];
  repositories: { id: string; name: string; description: string }[];
}

interface Resume {
  projects?: { name: string; type?: string }[];
  [key: string]: unknown;
}

describe('Repositorios destacados en la vista curada (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  const ids: string[] = [];

  const http = () => request(app.getHttpServer());
  const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);
  const view = async (slug = 'all') =>
    (await http().get(`/api/curated-profiles/${slug}`).expect(200)).body as View;

  async function createRepo(name: string, extra: Record<string, unknown> = {}): Promise<string> {
    const res = await auth(http().post('/api/admin/featured-repositories'))
      .send({
        name,
        url: `https://github.com/e2e-org/${name}`,
        language: 'Java',
        description: { es: `Descripción ${name}`, en: `Description ${name}` },
        technologies: ['Spring Boot'],
        tags: [],
        ...extra,
      })
      .expect(201);
    const id = (res.body as { id: string }).id;
    ids.push(id);
    return id;
  }

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await prisma.curatedProfile.deleteMany({ where: { slug: 'rr-e2e-orden' } });
    await prisma.featuredRepository.deleteMany({ where: { url: { contains: '/e2e-org/' } } });
    await createE2eAdmin(prisma);
    token = await login(app);
  });

  afterAll(async () => {
    await prisma.featuredRepository.deleteMany({ where: { url: { contains: '/e2e-org/' } } });
    await deleteE2eAdmin(prisma);
    await app.close();
  });

  it('sin repositorios, la vista trae la clave vacía y la sección no figura', async () => {
    const body = await view();
    expect(body.repositories).toEqual([]);
    expect(body.sections).not.toContain('repositories');
  });

  it('con dos repos sin tags, all los trae y la sección figura', async () => {
    const a = await createRepo('repo-a', { order: 1 });
    await createRepo('repo-b', { order: 2 });

    const body = await view();
    expect(body.repositories).toHaveLength(2);
    expect(body.repositories[0].id).toBe(a);
    expect(body.sections).toContain('repositories');
  });

  it('un perfil con orden vacío la muestra justo después de projects', async () => {
    await auth(http().post('/api/admin/curated-profiles'))
      .send({
        slug: 'rr-e2e-orden',
        title: { es: 'Orden', en: 'Order' },
        headline: { es: 'Titular', en: 'Headline' },
        filterTags: [],
        sectionsOrder: [],
      })
      .expect(201);
    try {
      const body = await view('rr-e2e-orden');
      expect(body.sections.indexOf('repositories')).toBe(body.sections.indexOf('projects') + 1);
    } finally {
      await prisma.curatedProfile.deleteMany({ where: { slug: 'rr-e2e-orden' } });
    }
  });

  it('la vista en inglés resuelve la descripción', async () => {
    const res = await http().get('/api/curated-profiles/all?locale=en').expect(200);
    const body = res.body as View;
    expect(body.repositories.map((r) => r.description)).toEqual([
      'Description repo-a',
      'Description repo-b',
    ]);
  });

  it('el JSON Resume de all valida y termina con dos proyectos de type repository', async () => {
    const res = await http().get('/api/curated-profiles/all/resume.json').expect(200);
    const document = res.body as Resume;
    expect(validateJsonResume(document).errors).toEqual([]);
    const projects = document.projects ?? [];
    expect(projects.slice(-2).map((p) => p.type)).toEqual(['repository', 'repository']);
    expect(projects.slice(-2).map((p) => p.name)).toEqual(['repo-a', 'repo-b']);
  });

  it('un perfil cuyos tags no coinciden resuelve 0 y no muestra la sección', async () => {
    const body = await view('tech-lead-dotnet');
    expect(body.repositories).toEqual([]);
    expect(body.sections).not.toContain('repositories');
  });

  it('con un repo oculto, el perfil resuelve 1: conserva el dato pero la sección desaparece', async () => {
    const [first] = ids;
    await auth(http().patch(`/api/admin/featured-repositories/${first}`))
      .send({ visible: false })
      .expect(200);
    const body = await view();
    expect(body.repositories).toHaveLength(1);
    expect(body.sections).not.toContain('repositories');

    const resume = (await http().get('/api/curated-profiles/all/resume.json').expect(200))
      .body as Resume;
    expect((resume.projects ?? []).some((p) => p.type === 'repository')).toBe(false);
  });

  it('borrando uno de dos, la sección desaparece y repositories tiene 1', async () => {
    const [first] = ids;
    await auth(http().patch(`/api/admin/featured-repositories/${first}`))
      .send({ visible: true })
      .expect(200);
    expect((await view()).sections).toContain('repositories');

    await auth(http().delete(`/api/admin/featured-repositories/${first}`)).expect(204);
    const body = await view();
    expect(body.repositories).toHaveLength(1);
    expect(body.sections).not.toContain('repositories');
  });
});

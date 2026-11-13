/**
 * E2E — change `add-job-posting-intake`: importación de vacantes, guarda SSRF, límite, sugerencia,
 * purga y borrador. El transporte HTTP y el resolvedor DNS son dobles (los fixtures se sirven por
 * URL y se registra cada petición): ningún test sale a internet.
 *
 * El límite de importaciones es de 10 por minuto por IP y vive en la instancia del servidor: cada
 * bloque arranca su propia app para no gastar el cupo de otro.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  DNS_RESOLVER,
  HTTP_TRANSPORT,
} from '../src/modules/job-posting/infrastructure/http/http-transport';
import { CLOCK } from '../src/shared/domain/clock';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';
import { createE2eAdmin, createTestApp, deleteE2eAdmin, login } from './e2e-helpers';
import {
  FakeDnsResolver,
  FakeHttpTransport,
  fixture,
  OffsetClock,
} from './support/job-posting-fakes';

const GH_URL = 'https://boards.greenhouse.io/acmeejemplo/jobs/4012345';
const GH_API = 'https://boards-api.greenhouse.io/v1/boards/acmeejemplo/jobs/4012345';
const LEVER_ID = '0b1c2d3e-aaaa-bbbb-cccc-1234567890ab';
const LEVER_URL = `https://jobs.lever.co/acmeejemplo/${LEVER_ID}`;
const LEVER_API = `https://api.lever.co/v0/postings/acmeejemplo/${LEVER_ID}`;
const ASHBY_ID = '9f8e7d6c-0000-1111-2222-333344445555';
const ASHBY_URL = `https://jobs.ashbyhq.com/acmeejemplo/${ASHBY_ID}`;
const ASHBY_API =
  'https://api.ashbyhq.com/posting-api/job-board/acmeejemplo?includeCompensation=true';
const PAGE = 'https://careers.acme-ejemplo.com/jobs/tech-lead-net';
const DAY = 24 * 60 * 60 * 1000;
const TEXT =
  'Tech Lead Backend\nBuscamos un líder con Java, Spring Boot y Kubernetes para nuestro equipo. Modalidad híbrida, dos días remoto.';

interface PostingBody {
  id: string;
  source: string;
  title: string;
  company: string | null;
  workplaceType: string | null;
  sourceUrl: string | null;
  applyUrl: string | null;
  description: string | null;
  detectedTerms: string[];
  textPurgeAt: string;
  textPurged: boolean;
  compensation: string | null;
  message?: string;
}

interface Harness {
  app: INestApplication;
  prisma: PrismaService;
  transport: FakeHttpTransport;
  resolver: FakeDnsResolver;
  clock: OffsetClock;
  bearer: string;
}

async function startHarness(): Promise<Harness> {
  const transport = new FakeHttpTransport();
  const resolver = new FakeDnsResolver();
  const clock = new OffsetClock();
  const { app, prisma } = await createTestApp((builder) =>
    builder
      .overrideProvider(HTTP_TRANSPORT)
      .useValue(transport)
      .overrideProvider(DNS_RESOLVER)
      .useValue(resolver)
      .overrideProvider(CLOCK)
      .useValue(clock),
  );
  await prisma.jobPosting.deleteMany();
  await createE2eAdmin(prisma);
  const bearer = await login(app);
  return { app, prisma, transport, resolver, clock, bearer };
}

async function stopHarness(h: Harness): Promise<void> {
  await h.prisma.jobPosting.deleteMany();
  await deleteE2eAdmin(h.prisma);
  await h.app.close();
}

const post = (h: Harness, body: Record<string, unknown>) =>
  request(h.app.getHttpServer())
    .post('/api/admin/job-postings')
    .set('Authorization', `Bearer ${h.bearer}`)
    .send(body);

const get = (h: Harness, url: string) =>
  request(h.app.getHttpServer()).get(url).set('Authorization', `Bearer ${h.bearer}`);

describe('Vacantes: importación (e2e)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(() => stopHarness(h));
  beforeEach(() => {
    h.transport.reset();
  });

  it('Greenhouse: 201 con los campos normalizados y la descripción sin etiquetas', async () => {
    h.transport.json(GH_API, fixture('greenhouse-job.json'));
    const res = await post(h, { url: GH_URL });
    expect(res.status).toBe(201);
    const body = res.body as PostingBody;
    expect(body).toMatchObject({
      source: 'GREENHOUSE',
      title: 'Tech Lead Backend (Java)',
      company: 'Acme Ejemplo',
      workplaceType: 'REMOTE',
      applyUrl: 'https://boards.greenhouse.io/acmeejemplo/jobs/4012345',
    });
    expect(body.description).not.toMatch(/<\/?[a-z]/i);
    expect(body.detectedTerms).toEqual(expect.arrayContaining(['java', 'kubernetes', 'aws']));
    expect(body.textPurged).toBe(false);
    expect(h.transport.requests).toEqual([GH_API]);
  });

  it('Lever: 201 con la modalidad y el applyUrl de Lever', async () => {
    h.transport.json(LEVER_API, fixture('lever-posting.json'));
    const res = await post(h, { url: LEVER_URL });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ source: 'LEVER', workplaceType: 'HYBRID' });
    expect((res.body as PostingBody).applyUrl).toBe(`${LEVER_URL}/apply`);
  });

  it('Ashby: 201 solo con la vacante pedida y su compensación', async () => {
    h.transport.json(ASHBY_API, fixture('ashby-board.json'));
    const res = await post(h, { url: ASHBY_URL });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      source: 'ASHBY',
      title: 'Staff Software Engineer',
      compensation: 'USD 120K - 150K',
    });
  });

  it('JSON-LD: 201; la misma URL con ?utm_source=x#apply da 200 y una sola fila', async () => {
    h.transport.html(PAGE, fixture('jsonld-graph.html'));
    const first = await post(h, { url: PAGE });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ source: 'JSON_LD', company: 'Acme Ejemplo' });

    h.transport.html(`${PAGE}?utm_source=x`, fixture('jsonld-graph.html'));
    const again = await post(h, { url: `${PAGE}?utm_source=x#apply` });
    expect(again.status).toBe(200);
    expect((again.body as PostingBody).id).toBe((first.body as PostingBody).id);
    expect(await h.prisma.jobPosting.count({ where: { source: 'JSON_LD' } })).toBe(1);
    // El fragmento nunca viaja; el parámetro de seguimiento sí se pide tal cual.
    expect(h.transport.requests).toEqual([PAGE, `${PAGE}?utm_source=x`]);
  });
});

describe('Vacantes: texto pegado y forma de la entrada (e2e)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(() => stopHarness(h));
  beforeEach(() => {
    h.transport.reset();
  });

  it('texto pegado: 201 sin ninguna petición; repetido (con otros espacios) 200', async () => {
    const first = await post(h, {
      text: TEXT,
      referenceUrl: 'https://www.linkedin.com/jobs/view/123',
    });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({
      source: 'PASTED',
      sourceUrl: 'https://www.linkedin.com/jobs/view/123',
      workplaceType: 'HYBRID',
      title: 'Tech Lead Backend',
    });
    const again = await post(h, {
      text: `  ${TEXT.replace(/ /g, '   ')}  `,
      referenceUrl: 'https://www.linkedin.com/jobs/view/123',
    });
    expect(again.status).toBe(200);
    expect((again.body as PostingBody).id).toBe((first.body as PostingBody).id);
    expect(h.transport.requests).toEqual([]);
  });

  it('url y text juntos, ninguno, texto de 49 caracteres o referencia http: 400', async () => {
    expect((await post(h, { url: GH_URL, text: TEXT })).status).toBe(400);
    expect((await post(h, {})).status).toBe(400);
    expect((await post(h, { text: 'a'.repeat(49) })).status).toBe(400);
    expect((await post(h, { text: TEXT, referenceUrl: 'http://x.acme-ejemplo.com' })).status).toBe(
      400,
    );
    expect((await post(h, { text: TEXT, campoNuevo: 1 })).status).toBe(400);
    expect(h.transport.requests).toEqual([]);
  });
});

describe('Vacantes: sin sesión (e2e)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(() => stopHarness(h));

  it('las cinco rutas dan 401 y no sale ninguna petición', async () => {
    h.transport.reset();
    const server = h.app.getHttpServer();
    // En serie: en paralelo, supertest abre un listener efímero por petición y en el CI
    // alguna conexión se cortaba con ECONNRESET.
    const calls = [
      () => request(server).post('/api/admin/job-postings').send({ url: GH_URL }),
      () => request(server).get('/api/admin/job-postings'),
      () => request(server).get('/api/admin/job-postings/x'),
      () => request(server).delete('/api/admin/job-postings/x'),
      () => request(server).get('/api/admin/job-postings/x/suggestion'),
      () => request(server).post('/api/admin/curated-profiles/from-job-posting').send({}),
    ];
    const results: request.Response[] = [];
    for (const call of calls) results.push(await call());
    expect(results.map((r) => r.status)).toEqual([401, 401, 401, 401, 401, 401]);
    expect(h.transport.requests).toEqual([]);
    expect(h.resolver.resolved).toEqual([]);
  });
});

describe('Vacantes: SSRF y portales cerrados (e2e)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(() => stopHarness(h));
  beforeEach(() => {
    h.transport.reset();
    h.resolver.hosts.clear();
    h.resolver.resolved.length = 0;
  });

  it.each([
    'https://www.linkedin.com/jobs/view/123',
    'https://lnkd.in/abc',
    'https://ar.indeed.com/viewjob?jk=1',
  ])('portal cerrado %s: 422 sin ninguna petición ni DNS', async (url) => {
    const res = await post(h, { url });
    expect(res.status).toBe(422);
    expect((res.body as PostingBody).message).toContain('no permite leer sus vacantes');
    expect(h.transport.requests).toEqual([]);
    expect(h.resolver.resolved).toEqual([]);
  });

  it('http:, IP decimal y puerto interno: 422 sin ninguna petición', async () => {
    for (const url of [
      'http://careers.acme-ejemplo.com/job/1',
      'https://2130706433/',
      'https://[::1]/',
      'https://careers.acme-ejemplo.com:5432/',
      'https://api.railway.internal/',
    ]) {
      expect((await post(h, { url })).status).toBe(422);
    }
    expect((await post(h, { url: 'http://careers.acme-ejemplo.com/job/1' })).body).toMatchObject({
      message: 'Usá una URL que empiece con https://',
    });
    expect(h.transport.requests).toEqual([]);
    expect(h.resolver.resolved).toEqual([]);
  });
});

describe('Vacantes: SSRF, red y redirects (e2e)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(() => stopHarness(h));
  beforeEach(() => {
    h.transport.reset();
    h.resolver.hosts.clear();
    h.resolver.resolved.length = 0;
  });

  it('un host que resuelve a 10.0.0.5: 422 sin la IP en el cuerpo ni conexión', async () => {
    h.resolver.hosts.set('vacantes.acme-ejemplo.com', [{ address: '10.0.0.5', family: 4 }]);
    const res = await post(h, { url: 'https://vacantes.acme-ejemplo.com/job/1' });
    expect(res.status).toBe(422);
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
    expect(h.transport.requests).toEqual([]);
  });

  it('redirect 301 a un host que resuelve a 172.16.0.10: 422 y el destino nunca se pide', async () => {
    h.resolver.hosts.set('interno.acme-ejemplo.com', [{ address: '172.16.0.10', family: 4 }]);
    h.transport.redirect(PAGE, 'https://interno.acme-ejemplo.com/');
    const res = await post(h, { url: PAGE });
    expect(res.status).toBe(422);
    expect(JSON.stringify(res.body)).not.toContain('172.16');
    expect(h.transport.requests).toEqual([PAGE]);
  });

  it('redirect a un portal cerrado o a http: 422 sin seguirlo', async () => {
    h.transport.redirect(PAGE, 'https://lnkd.in/abc', 302);
    const closed = await post(h, { url: PAGE });
    expect(closed.status).toBe(422);
    expect((closed.body as PostingBody).message).toContain('LinkedIn');
    h.transport.redirect(PAGE, 'http://careers.acme-ejemplo.com/x', 302);
    expect((await post(h, { url: PAGE })).status).toBe(422);
    expect(h.transport.requests).toEqual([PAGE, PAGE]);
  });

  it('cuatro redirects: 422 «redirige demasiadas veces»', async () => {
    const hop = (n: number) => `https://careers.acme-ejemplo.com/h${n}`;
    h.transport.redirect(PAGE, hop(1));
    for (let n = 1; n <= 4; n += 1) h.transport.redirect(hop(n), hop(n + 1));
    const res = await post(h, { url: PAGE });
    expect(res.status).toBe(422);
    expect((res.body as PostingBody).message).toBe(
      'La página redirige demasiadas veces. Pegá el texto de la vacante.',
    );
  });

  it('una página sin JSON-LD: 422 con el mensaje literal', async () => {
    h.transport.html(PAGE, fixture('no-jsonld.html'));
    const res = await post(h, { url: PAGE });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      statusCode: 422,
      message: 'No encontramos una vacante en esa página. Pegá el texto de la vacante.',
    });
  });

  it('un 404 del ATS y un tipo inesperado: 422 accionables', async () => {
    h.transport.routes.set(GH_API, { status: 404, contentType: 'application/json', body: '{}' });
    const closed = await post(h, { url: GH_URL });
    expect(closed.status).toBe(422);
    expect((closed.body as PostingBody).message).toBe(
      'No encontramos esa vacante (puede estar cerrada). Pegá el texto de la vacante.',
    );
    h.transport.routes.set(PAGE, { contentType: 'application/pdf', body: '%PDF' });
    expect((await post(h, { url: PAGE })).status).toBe(422);
  });

  it('nada de lo anterior guardó vacantes', async () => {
    expect(await h.prisma.jobPosting.count()).toBe(0);
  });
});

describe('Vacantes: límite de importaciones (e2e)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(() => stopHarness(h));

  it('el undécimo POST seguido da 429 con Retry-After y sin llegar al transporte; GET sigue', async () => {
    h.transport.reset();
    h.transport.html(PAGE, fixture('jsonld-graph.html'));
    for (let n = 1; n <= 10; n += 1) {
      const res = await post(h, { url: `${PAGE}?n=${n}` }).catch((error: unknown) => {
        throw error;
      });
      // Las páginas `?n=` no están servidas: da 422 por la red, pero cuenta para el límite.
      expect([201, 422]).toContain(res.status);
    }
    const before = h.transport.requests.length;
    const eleventh = await post(h, { url: PAGE });
    expect(eleventh.status).toBe(429);
    expect(eleventh.headers['retry-after']).toBeDefined();
    expect(h.transport.requests.length).toBe(before);

    const list = await get(h, '/api/admin/job-postings');
    expect(list.status).toBe(200);
  });
});

describe('Vacantes: sugerencia, purga y borrador (e2e)', () => {
  let h: Harness;
  const createdExperiences: string[] = [];
  const createdSlugs: string[] = [];

  beforeAll(async () => {
    h = await startHarness();
    await h.prisma.curatedProfile.deleteMany({
      where: { slug: { startsWith: 'acme-e2e-intake' } },
    });
  });
  afterAll(async () => {
    await h.prisma.experience.deleteMany({ where: { id: { in: createdExperiences } } });
    await h.prisma.curatedProfile.deleteMany({ where: { slug: { in: createdSlugs } } });
    await stopHarness(h);
  });
  beforeEach(() => {
    h.transport.reset();
    h.clock.offsetMs = 0;
  });

  const vocabulary = async (): Promise<Set<string>> => {
    const [experiences, projects, skills] = await Promise.all([
      h.prisma.experience.findMany({ where: { visible: true }, select: { tags: true } }),
      h.prisma.project.findMany({ where: { visible: true }, select: { tags: true } }),
      h.prisma.skill.findMany({ select: { tags: true } }),
    ]);
    return new Set([...experiences, ...projects, ...skills].flatMap((row) => row.tags));
  };

  it('la sugerencia solo trae tags del vocabulario; ocultar la experiencia lo pasa a «sin respaldo»', async () => {
    const experience = await h.prisma.experience.create({
      data: {
        company: 'ACME E2E Intake',
        role: { es: 'Rol', en: 'Role' },
        startDate: '2020-01',
        location: 'Remoto',
        summary: { es: 'x', en: 'x' },
        highlights: { es: [], en: [] },
        technologies: [],
        tags: ['tag-e2e-intake-unico'],
        sector: [],
        visible: true,
      },
    });
    createdExperiences.push(experience.id);

    const imported = await post(h, {
      text: 'Backend con Java y Kubernetes. Se valora tag e2e intake unico y también Golang. Equipo remoto.',
    });
    expect(imported.status).toBe(201);
    const id = (imported.body as PostingBody).id;

    const first = await get(h, `/api/admin/job-postings/${id}/suggestion`);
    expect(first.status).toBe(200);
    const suggestion = first.body as {
      coverage: { covered: Array<{ tag: string }>; uncovered: string[] };
      suggestedFilterTags: string[];
    };
    const vocab = await vocabulary();
    expect(suggestion.suggestedFilterTags.length).toBeGreaterThan(0);
    expect(suggestion.suggestedFilterTags.every((tag) => vocab.has(tag))).toBe(true);
    expect(suggestion.suggestedFilterTags).toContain('tag-e2e-intake-unico');
    expect(suggestion.coverage.uncovered).toContain('go');
    expect(Object.keys(first.body as object).sort()).toEqual([
      'coverage',
      'suggestedFilterTags',
      'suggestedSlugBase',
      'suggestedTitle',
    ]);

    await h.prisma.experience.update({ where: { id: experience.id }, data: { visible: false } });
    const second = await get(h, `/api/admin/job-postings/${id}/suggestion`);
    const after = second.body as typeof suggestion;
    expect(after.suggestedFilterTags).not.toContain('tag-e2e-intake-unico');
    expect(after.coverage.uncovered).toContain('tag-e2e-intake-unico');
  });

  it('con el reloj a +91 días: description null, la sugerencia sigue y la lista purga', async () => {
    const imported = await post(h, { text: `${TEXT} Versión de purga.` });
    const id = (imported.body as PostingBody).id;
    expect((imported.body as PostingBody).textPurged).toBe(false);

    h.clock.offsetMs = 91 * DAY;
    const list = await get(h, '/api/admin/job-postings');
    const row = (list.body as PostingBody[]).find((p) => p.id === id);
    expect(row?.description).toBeNull();
    expect(row?.textPurged).toBe(true);
    expect(row?.title).toBe('Tech Lead Backend');
    expect(row?.detectedTerms.length).toBeGreaterThan(0);

    const one = await get(h, `/api/admin/job-postings/${id}`);
    expect((one.body as PostingBody).description).toBeNull();
    expect((await get(h, `/api/admin/job-postings/${id}/suggestion`)).status).toBe(200);
  });

  it('from-job-posting crea un PRIVATE no enumerado; tag inventado 400; slug ocupado 409; vacante inexistente 404', async () => {
    const imported = await post(h, { text: `${TEXT} Para el borrador.` });
    const jobPostingId = (imported.body as PostingBody).id;
    const suggestion = (await get(h, `/api/admin/job-postings/${jobPostingId}/suggestion`))
      .body as { suggestedFilterTags: string[]; suggestedSlugBase: string };
    expect(suggestion.suggestedFilterTags.length).toBeGreaterThan(0);

    const slug = 'acme-e2e-intake-borrador';
    createdSlugs.push(slug);
    const create = (body: Record<string, unknown>) =>
      request(h.app.getHttpServer())
        .post('/api/admin/curated-profiles/from-job-posting')
        .set('Authorization', `Bearer ${h.bearer}`)
        .send(body);

    const created = await create({
      jobPostingId,
      filterTags: suggestion.suggestedFilterTags,
      title: 'Para Acme E2E',
      slug,
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      slug,
      visibility: 'PRIVATE',
      listed: false,
      filterTags: suggestion.suggestedFilterTags,
    });
    const profileId = (created.body as { id: string }).id;
    const stored = await h.prisma.curatedProfile.findUnique({ where: { id: profileId } });
    expect(stored?.accessToken).toBeNull();

    // No enumerado: ni en el sitemap ni en la ruta pública.
    const sitemap = await request(h.app.getHttpServer()).get('/sitemap.xml');
    expect(sitemap.text).not.toContain(slug);
    expect((await request(h.app.getHttpServer()).get(`/api/curated-profiles/${slug}`)).status).toBe(
      404,
    );

    expect((await create({ jobPostingId, filterTags: ['tag-inventado-e2e'] })).status).toBe(400);
    const invented = await create({ jobPostingId, filterTags: ['tag-inventado-e2e'] });
    expect((invented.body as PostingBody).message).toContain('tag-inventado-e2e');
    expect(
      (await create({ jobPostingId, filterTags: suggestion.suggestedFilterTags, slug })).status,
    ).toBe(409);
    expect(
      (await create({ jobPostingId: 'no-existe', filterTags: suggestion.suggestedFilterTags }))
        .status,
    ).toBe(404);
    expect((await create({ jobPostingId, filterTags: [] })).status).toBe(400);

    // Sin slug: se deriva de empresa y puesto con el primer sufijo libre.
    const derived = await create({ jobPostingId, filterTags: suggestion.suggestedFilterTags });
    expect(derived.status).toBe(201);
    const derivedSlug = (derived.body as { slug: string }).slug;
    createdSlugs.push(derivedSlug);
    expect(derivedSlug).toMatch(new RegExp(`^${suggestion.suggestedSlugBase}(-\\d+)?$`));

    // Borrar la vacante: 204, ya no se lee y el perfil sigue igual.
    expect(
      (
        await request(h.app.getHttpServer())
          .delete(`/api/admin/job-postings/${jobPostingId}`)
          .set('Authorization', `Bearer ${h.bearer}`)
      ).status,
    ).toBe(204);
    expect((await get(h, `/api/admin/job-postings/${jobPostingId}`)).status).toBe(404);
    const after = await h.prisma.curatedProfile.findUnique({ where: { id: profileId } });
    expect(after?.slug).toBe(slug);
    expect(after?.filterTags).toEqual(suggestion.suggestedFilterTags);
  });
});

describe('Vacantes: solo en el panel (e2e)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(() => stopHarness(h));

  it('no hay ruta pública, la ruta de un perfil no cambia y el sitemap tampoco', async () => {
    const server = h.app.getHttpServer();
    const publicBefore = await request(server).get('/api/curated-profiles/tech-lead-dotnet');
    const sitemapBefore = await request(server).get('/sitemap.xml');
    expect(publicBefore.status).toBe(200);

    expect((await request(server).get('/api/job-postings')).status).toBe(404);
    expect((await request(server).get('/api/public/job-postings')).status).toBe(404);

    expect((await post(h, { text: `${TEXT} Solo panel.` })).status).toBe(201);

    const publicAfter = await request(server).get('/api/curated-profiles/tech-lead-dotnet');
    const sitemapAfter = await request(server).get('/sitemap.xml');
    expect(publicAfter.body).toEqual(publicBefore.body);
    expect(sitemapAfter.text).toBe(sitemapBefore.text);
    expect(JSON.stringify(publicAfter.body)).not.toContain('Solo panel');
  });
});

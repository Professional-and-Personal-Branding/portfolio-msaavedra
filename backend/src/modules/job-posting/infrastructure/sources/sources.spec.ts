import { MAX_HTML_BYTES, MAX_JSON_BYTES } from '../../application/ports/job-posting-source';
import { ImportFailure } from '../../domain/errors/import-failure';
import { AshbySource } from './ashby.source';
import { GreenhouseSource } from './greenhouse.source';
import { JsonLdJobPostingSource } from './json-ld-job-posting.source';
import {
  describeJobPostingSourceContract,
  FakeSafeHttpClient,
  readFixture,
} from './job-posting-source.contract.fixture';
import { LeverSource } from './lever.source';

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

const signal = () => AbortSignal.timeout(2000);

describeJobPostingSourceContract('Greenhouse', (c) => new GreenhouseSource(c), [
  {
    name: 'con company_name',
    url: GH_URL,
    responses: { [GH_API]: readFixture('greenhouse-job.json') },
  },
  {
    name: 'sin company_name',
    url: 'https://boards.greenhouse.io/acme-ejemplo/jobs/4012346',
    responses: {
      'https://boards-api.greenhouse.io/v1/boards/acme-ejemplo/jobs/4012346': readFixture(
        'greenhouse-no-company.json',
      ),
    },
  },
]);
describeJobPostingSourceContract('Lever', (c) => new LeverSource(c), [
  {
    name: 'posting',
    url: LEVER_URL,
    responses: { [LEVER_API]: readFixture('lever-posting.json') },
  },
]);
describeJobPostingSourceContract('Ashby', (c) => new AshbySource(c), [
  { name: 'board', url: ASHBY_URL, responses: { [ASHBY_API]: readFixture('ashby-board.json') } },
]);
describeJobPostingSourceContract('JSON-LD', (c) => new JsonLdJobPostingSource(c), [
  { name: '@graph', url: PAGE, responses: { [PAGE]: readFixture('jsonld-graph.html') } },
  { name: 'arreglo', url: PAGE, responses: { [PAGE]: readFixture('jsonld-array.html') } },
  {
    name: 'primer bloque inválido',
    url: PAGE,
    responses: { [PAGE]: readFixture('jsonld-invalid-then-valid.html') },
  },
]);

describe('GreenhouseSource', () => {
  it('normaliza el fixture: título, empresa, ubicación, descripción sin etiquetas, applyUrl y fecha', async () => {
    const client = new FakeSafeHttpClient({ [GH_API]: readFixture('greenhouse-job.json') });
    const result = await new GreenhouseSource(client).fetch(new URL(GH_URL), signal());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      source: 'GREENHOUSE',
      sourceKey: 'greenhouse:acmeejemplo:4012345',
      title: 'Tech Lead Backend (Java)',
      company: 'Acme Ejemplo',
      location: 'Remote - Argentina',
      workplaceType: 'REMOTE',
      applyUrl: 'https://boards.greenhouse.io/acmeejemplo/jobs/4012345',
      language: 'en',
    });
    expect(result.value.description).toContain('microservices with Java and Spring Boot');
    expect(result.value.description).toContain('• Kubernetes and AWS');
    expect(result.value.postedAt?.toISOString()).toBe('2026-10-30T17:21:05.000Z');
  });

  it('humaniza el board si falta company_name y descarta un applyUrl http', async () => {
    const api = 'https://boards-api.greenhouse.io/v1/boards/acme-ejemplo/jobs/4012346';
    const client = new FakeSafeHttpClient({ [api]: readFixture('greenhouse-no-company.json') });
    const result = await new GreenhouseSource(client).fetch(
      new URL('https://job-boards.greenhouse.io/acme-ejemplo/jobs/4012346'),
      signal(),
    );
    expect(result.ok && result.value.company).toBe('Acme Ejemplo');
    expect(result.ok && result.value.applyUrl).toBeNull();
    expect(result.ok && result.value.workplaceType).toBe('HYBRID');
  });

  it('la API se pide en el host fijo, en JSON y con el tope de 5 MiB', async () => {
    const client = new FakeSafeHttpClient({ [GH_API]: readFixture('greenhouse-job.json') });
    await new GreenhouseSource(client).fetch(new URL(`${GH_URL}?utm_source=x#apply`), signal());
    expect(client.requested).toHaveLength(1);
    expect(client.requested[0].url).toBe(GH_API);
    expect(client.requested[0].options).toMatchObject({ accept: 'json', maxBytes: MAX_JSON_BYTES });
  });

  it('la variante EU no se atiende (no documentada): cae al respaldo', () => {
    const source = new GreenhouseSource(new FakeSafeHttpClient({}));
    expect(source.canHandle(new URL('https://boards.eu.greenhouse.io/acme/jobs/1'))).toBe(false);
    expect(source.canHandle(new URL(GH_URL))).toBe(true);
    expect(source.canHandle(new URL(LEVER_URL))).toBe(false);
  });

  it('propaga el fallo del cliente y un JSON inválido da 422', async () => {
    const down = ImportFailure.withHint(
      'not-found',
      'No encontramos esa vacante (puede estar cerrada)',
    );
    const failing = await new GreenhouseSource(new FakeSafeHttpClient({ [GH_API]: down })).fetch(
      new URL(GH_URL),
      signal(),
    );
    expect(!failing.ok && failing.error).toBe(down);
    const garbage = await new GreenhouseSource(
      new FakeSafeHttpClient({ [GH_API]: 'no json' }),
    ).fetch(new URL(GH_URL), signal());
    expect(!garbage.ok && garbage.error.reason).toBe('unparseable');
    const noTitle = await new GreenhouseSource(
      new FakeSafeHttpClient({ [GH_API]: '{"id":1}' }),
    ).fetch(new URL(GH_URL), signal());
    expect(!noTitle.ok && noTitle.error.reason).toBe('unparseable');
  });
});

describe('LeverSource', () => {
  it('descripción = descriptionPlain + listas + additionalPlain; createdAt en ms; modalidad', async () => {
    const client = new FakeSafeHttpClient({ [LEVER_API]: readFixture('lever-posting.json') });
    const result = await new LeverSource(client).fetch(new URL(`${LEVER_URL}/apply`), signal());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      source: 'LEVER',
      sourceKey: `lever:acmeejemplo:${LEVER_ID}`,
      title: 'Senior Platform Engineer',
      company: 'Acmeejemplo',
      location: 'Buenos Aires, Argentina',
      workplaceType: 'HYBRID',
      employmentType: 'Full-time',
      applyUrl: `${LEVER_URL}/apply`,
      language: 'es',
    });
    const text = result.value.description;
    expect(text.indexOf('Buscamos un ingeniero')).toBeLessThan(text.indexOf('Requisitos'));
    expect(text).toContain('Requisitos\n• Experiencia con Docker\n• Go o Java');
    expect(text.indexOf('Beneficios')).toBeLessThan(text.indexOf('Acme Ejemplo es un empleador'));
    expect(result.value.postedAt?.toISOString()).toBe('2025-10-30T16:00:00.000Z');
  });

  it('jobs.eu.lever.co usa api.eu.lever.co', async () => {
    const euApi = `https://api.eu.lever.co/v0/postings/acmeejemplo/${LEVER_ID}`;
    const client = new FakeSafeHttpClient({ [euApi]: readFixture('lever-posting.json') });
    const result = await new LeverSource(client).fetch(
      new URL(`https://jobs.eu.lever.co/acmeejemplo/${LEVER_ID}`),
      signal(),
    );
    expect(result.ok).toBe(true);
    expect(client.requested[0].url).toBe(euApi);
  });

  it('solo atiende URLs de Lever', () => {
    const source = new LeverSource(new FakeSafeHttpClient({}));
    expect(source.canHandle(new URL(LEVER_URL))).toBe(true);
    expect(source.canHandle(new URL(GH_URL))).toBe(false);
  });
});

describe('AshbySource', () => {
  const source = (body = readFixture('ashby-board.json')) =>
    new AshbySource(new FakeSafeHttpClient({ [ASHBY_API]: body }));

  it('elige solo la vacante pedida, con su compensación como texto', async () => {
    const result = await source().fetch(new URL(`${ASHBY_URL}/application`), signal());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      source: 'ASHBY',
      sourceKey: `ashby:acmeejemplo:${ASHBY_ID}`,
      title: 'Staff Software Engineer',
      location: 'Remote (Argentina)',
      workplaceType: 'REMOTE',
      employmentType: 'FullTime',
      compensation: 'USD 120K - 150K',
      applyUrl: `${ASHBY_URL}/application`,
    });
    expect(result.value.description).not.toContain('Disena interfaces');
  });

  it('otra vacante del board no trae compensación', async () => {
    const other = '11111111-2222-3333-4444-555555555555';
    const result = await source().fetch(
      new URL(`https://jobs.ashbyhq.com/acmeejemplo/${other}`),
      signal(),
    );
    expect(result.ok && result.value.title).toBe('Product Designer');
    expect(result.ok && result.value.compensation).toBeNull();
    expect(result.ok && result.value.workplaceType).toBe('ONSITE');
  });

  it('un id ausente da 422 «no encontramos esa vacante»', async () => {
    const result = await source().fetch(
      new URL('https://jobs.ashbyhq.com/acmeejemplo/00000000-0000-0000-0000-000000000000'),
      signal(),
    );
    expect(!result.ok && result.error.message).toBe(
      'No encontramos esa vacante (puede estar cerrada). Pegá el texto de la vacante.',
    );
  });

  it('pide el board con includeCompensation=true y el tope de 5 MiB', async () => {
    const client = new FakeSafeHttpClient({ [ASHBY_API]: readFixture('ashby-board.json') });
    await new AshbySource(client).fetch(new URL(ASHBY_URL), signal());
    expect(client.requested[0].url).toContain('includeCompensation=true');
    expect(client.requested[0].options.maxBytes).toBe(MAX_JSON_BYTES);
  });

  it('un board sin jobs es ilegible', async () => {
    const result = await source('{"foo":1}').fetch(new URL(ASHBY_URL), signal());
    expect(!result.ok && result.error.reason).toBe('unparseable');
  });
});

describe('JsonLdJobPostingSource', () => {
  const run = async (fixture: string, url = PAGE) => {
    const client = new FakeSafeHttpClient({ [url]: readFixture(fixture) });
    const result = await new JsonLdJobPostingSource(client).fetch(new URL(url), signal());
    return { result, client };
  };

  it('@graph con @type arreglo: empresa, ubicación, TELECOMMUTE → REMOTE, salario y fecha', async () => {
    const { result, client } = await run('jsonld-graph.html');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      source: 'JSON_LD',
      sourceKey: `jsonld:${PAGE}`,
      title: 'Tech Lead .NET',
      company: 'Acme Ejemplo',
      location: 'Buenos Aires, CABA, AR',
      workplaceType: 'REMOTE',
      employmentType: 'full-time',
      compensation: 'USD 4000 - 6000 / month',
      applyUrl: 'https://careers.acme-ejemplo.com/jobs/tech-lead-net',
    });
    expect(result.value.description).toContain('.NET Core y C#');
    expect(result.value.description).toContain('• Microservicios');
    expect(result.value.postedAt?.toISOString()).toBe('2026-10-25T00:00:00.000Z');
    expect(client.requested[0].options).toMatchObject({ accept: 'html', maxBytes: MAX_HTML_BYTES });
  });

  it('arreglo de objetos: un url http deja applyUrl nulo', async () => {
    const { result } = await run('jsonld-array.html');
    expect(result.ok && result.value.title).toBe('Backend Developer');
    expect(result.ok && result.value.applyUrl).toBeNull();
    expect(result.ok && result.value.location).toBe('Cordoba, AR');
  });

  it('salta un primer bloque que no es JSON y usa el siguiente', async () => {
    const { result } = await run('jsonld-invalid-then-valid.html');
    expect(result.ok && result.value.title).toBe('DevOps Engineer');
    expect(result.ok && result.value.employmentType).toBe('contractor');
  });

  it('sin bloque JobPosting: 422 con el mensaje literal', async () => {
    const { result } = await run('no-jsonld.html');
    expect(!result.ok && result.error.message).toBe(
      'No encontramos una vacante en esa página. Pegá el texto de la vacante.',
    );
    expect(!result.ok && result.error.reason).toBe('no-posting-found');
  });

  it('la clave usa la URL canónica, sin parámetros de seguimiento', async () => {
    const requested = `${PAGE}?utm_source=x`;
    const source = new JsonLdJobPostingSource(
      new FakeSafeHttpClient({ [requested]: readFixture('jsonld-graph.html') }),
    );
    const result = await source.fetch(new URL(requested), signal());
    expect(result.ok && result.value.sourceKey).toBe(`jsonld:${PAGE}`);
  });
});

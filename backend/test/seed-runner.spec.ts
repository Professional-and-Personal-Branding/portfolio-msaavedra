import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SECTION_IDS } from '../src/modules/curated-profile/domain/services/resolve-sections';
import { SEED_CONTENT_TABLES } from '../scripts/lib/seed-guard';
import { executeSeed, parseSeedArgs, readSeedFile } from '../scripts/lib/seed-runner';

/**
 * Orquestación del seed (change `add-learning-guide-and-example-data`, D5 y D6) con un cliente
 * de Prisma simulado: ningún test toca una base de datos.
 */
interface Call {
  model: string;
  method: string;
  args: unknown;
}

const WRITE_METHODS = new Set(['create', 'createMany', 'update', 'deleteMany']);

/**
 * Cliente simulado: registra cada llamada. Las escrituras devuelven `{ id: "<modelo>-<n>" }` y
 * solo ellas avanzan el contador (protect-default-seed, D7): los ids de las escrituras no
 * dependen de cuántas lecturas hubo antes. `count` devuelve 0 y `findMany` `[]` por defecto;
 * una respuesta configurada que sea un `Error` rechaza la llamada.
 */
function fakePrisma(responses: Record<string, unknown> = {}): {
  prisma: PrismaClient;
  calls: Call[];
} {
  const calls: Call[] = [];
  let counter = 0;
  const prisma = new Proxy(
    {},
    {
      get(_t, model: string) {
        if (model === '$disconnect') return () => Promise.resolve();
        return new Proxy(
          {},
          {
            get(_u, method: string) {
              return (args: unknown) => {
                calls.push({ model, method, args: args ?? null });
                const configured = responses[`${model}.${method}`];
                if (configured instanceof Error) return Promise.reject(configured);
                if (configured !== undefined) return Promise.resolve(configured);
                if (method === 'count') return Promise.resolve(0);
                if (method === 'findMany') return Promise.resolve([]);
                if (WRITE_METHODS.has(method)) counter += 1;
                return Promise.resolve({ id: `${model}-${counter}` });
              };
            },
          },
        );
      },
    },
  ) as unknown as PrismaClient;
  return { prisma, calls };
}

const cvDataPath = path.resolve(__dirname, '../../docs/cv-data.json');
type Mutable = Record<string, unknown>;
const cvData = (): Mutable => JSON.parse(fs.readFileSync(cvDataPath, 'utf-8')) as Mutable;
const quiet = { log: () => undefined, error: () => undefined };
const writes = (calls: Call[]): Call[] =>
  calls.filter((c) => c.method !== 'findMany' && c.method !== 'count');

/**
 * Instantánea de lo que el seed escribía desde `docs/cv-data.json` ANTES del formato extendido:
 * 79 llamadas, tomadas del script original con este mismo cliente simulado. Si cambia, el seed
 * por defecto ya no hace lo de siempre (spec `data-persistence-seed`).
 */
const LEGACY_CALLS = 79;
// El digest cambió una sola vez, con `add-featured-repositories`: `sectionsOrder` de cada perfil
// copia `SECTION_IDS`, que ganó `repositories`. Quitando ese id del resultado, el digest sigue
// siendo el original (24ef8090…): el resto de lo que escribe el seed no cambió.
const LEGACY_SHA256 = 'ac70bd16532b013c97857c5793f66e3e6ae73a1967705196264f5d1b5b24bfdd';

describe('executeSeed · repositorios destacados (add-featured-repositories, D14)', () => {
  const repoRow = (name: string, visible: boolean, extra: Mutable = {}): Mutable => ({
    name,
    url: `https://github.com/octo-org/${name}`,
    description: { es: 'd', en: 'd' },
    tags: [],
    visible,
    ...extra,
  });

  it('crea todos (también los ocultos) con order = posición, sin stars', async () => {
    const data = cvData();
    (data['profile'] as Mutable)['featuredRepositories'] = [
      repoRow('uno', true, { stars: 99, language: 'Java' }),
      repoRow('dos', false),
    ];
    const { prisma, calls } = fakePrisma();
    expect(await executeSeed(prisma, data, { guarded: false, env: {}, ...quiet })).toBe(0);
    const created = calls
      .filter((c) => c.model === 'featuredRepository' && c.method === 'create')
      .map((c) => (c.args as { data: Mutable }).data);
    expect(created).toHaveLength(2);
    expect(created[0]).toMatchObject({ name: 'uno', order: 0, visible: true, language: 'Java' });
    expect(created[1]).toMatchObject({ name: 'dos', order: 1, visible: false, language: null });
    for (const row of created) expect(row).not.toHaveProperty('stars');
  });

  it('traduce repository:<id> al id generado en includeIds', async () => {
    const data = cvData();
    (data['profile'] as Mutable)['featuredRepositories'] = [
      repoRow('uno', true, { id: 'primero' }),
      repoRow('dos', false, { id: 'oculto' }),
    ];
    (data['profileTemplates'] as Mutable[])[0]['includeRefs'] = ['repository:oculto'];
    const { prisma, calls } = fakePrisma();
    expect(await executeSeed(prisma, data, { guarded: false, env: {}, ...quiet })).toBe(0);
    const profileData = calls
      .filter((c) => c.model === 'curatedProfile' && c.method === 'create')
      .map((c) => (c.args as { data: { includeIds?: string[] } }).data)
      .find((row) => (row.includeIds ?? []).length > 0);
    expect(profileData?.includeIds).toHaveLength(1);
    expect(profileData?.includeIds?.[0]).toMatch(/^featuredRepository-\d+$/);
  });

  it('una URL inválida corta con código 1 antes de escribir', async () => {
    const data = cvData();
    (data['profile'] as Mutable)['featuredRepositories'] = [
      repoRow('uno', true, { url: 'https://gitlab.com/a/b' }),
    ];
    const { prisma, calls } = fakePrisma();
    const code = await executeSeed(prisma, data, { guarded: false, env: {}, ...quiet });
    expect(code).toBe(1);
    expect(writes(calls)).toEqual([]);
  });
});

describe('executeSeed · seed por defecto (sin --file)', () => {
  it('escribe exactamente lo mismo que antes del formato extendido', async () => {
    const { prisma, calls } = fakePrisma();
    const code = await executeSeed(prisma, cvData(), { guarded: false, env: {}, ...quiet });
    expect(code).toBe(0);
    const written = writes(calls);
    expect(written).toHaveLength(LEGACY_CALLS);
    const digest = crypto.createHash('sha256').update(JSON.stringify(written)).digest('hex');
    expect(digest).toBe(LEGACY_SHA256);
    // Con la base vacía solo se agregan los 13 conteos, antes de la primera escritura.
    expect(calls).toHaveLength(LEGACY_CALLS + SEED_CONTENT_TABLES.length);
    expect(calls.slice(0, 13).map((c) => `${c.model}.${c.method}`)).toEqual(
      SEED_CONTENT_TABLES.map((t) => `${t.model}.count`),
    );
  });

  it('escribe la credencial de la certificación solo cuando la fuente la trae', async () => {
    const data = cvData();
    const certs = data['certifications'] as Mutable[];
    Object.assign(certs[0], {
      verificationUrl: 'https://example.org/c/1',
      credentialId: 'EJ-1',
      expiresAt: '2029-06',
    });
    const { prisma, calls } = fakePrisma();
    expect(await executeSeed(prisma, data, { guarded: false, env: {}, ...quiet })).toBe(0);
    const created = calls
      .filter((c) => c.model === 'certification' && c.method === 'create')
      .map((c) => (c.args as { data: Mutable }).data);
    expect(created[0]).toMatchObject({
      verificationUrl: 'https://example.org/c/1',
      credentialId: 'EJ-1',
      expiresAt: '2029-06',
    });
    expect(created[1]).not.toHaveProperty('verificationUrl');
    expect(created[1]).not.toHaveProperty('credentialId');
    expect(created[1]).not.toHaveProperty('expiresAt');
  });

  it('con la base vacía solo cuenta antes de escribir y no exige SEED_DISPOSABLE_DB', async () => {
    const { prisma, calls } = fakePrisma();
    await executeSeed(prisma, cvData(), { guarded: false, env: {}, ...quiet });
    expect(calls.slice(0, 13).every((c) => c.method === 'count')).toBe(true);
    expect(`${calls[13].model}.${calls[13].method}`).toBe('profileView.deleteMany');
    expect(calls.some((c) => c.method === 'findMany')).toBe(false);
  });

  it('SEED_CONTENT_TABLES coincide con la secuencia de deleteMany del seed (D1)', async () => {
    const { prisma, calls } = fakePrisma();
    await executeSeed(prisma, cvData(), { guarded: false, env: {}, ...quiet });
    const cleaned = calls.filter((c) => c.method === 'deleteMany').map((c) => c.model);
    expect(SEED_CONTENT_TABLES.map((t) => t.model)).toEqual(cleaned);
  });

  it('cada plantilla queda con los valores por defecto de siempre', async () => {
    const { prisma, calls } = fakePrisma();
    await executeSeed(prisma, cvData(), { guarded: false, env: {}, ...quiet });
    const profiles = calls.filter((c) => c.model === 'curatedProfile' && c.method === 'create');
    expect(profiles).toHaveLength(14);
    for (const p of profiles) {
      const data = (p.args as { data: Mutable }).data;
      expect(data['visibility']).toBe('PUBLIC');
      expect(data['layout']).toBe('classic');
      expect(data['sectionsOrder']).toEqual([...SECTION_IDS]);
      for (const key of [
        'sectionsHidden',
        'includeIds',
        'excludeIds',
        'accessToken',
        'archivedAt',
        'slugAliases',
      ]) {
        expect(data).not.toHaveProperty(key);
      }
    }
  });
});

describe('executeSeed · fuente inválida (D5)', () => {
  it('termina con 1, nombra el campo y no borra nada', async () => {
    const d = cvData();
    (d['profileTemplates'] as Mutable[])[3]['visibility'] = 'PROTECTED';
    const errors: string[] = [];
    const { prisma, calls } = fakePrisma();
    const code = await executeSeed(prisma, d, {
      guarded: false,
      env: {},
      log: () => undefined,
      error: (m) => errors.push(m),
    });
    expect(code).toBe(1);
    expect(calls).toEqual([]);
    expect(errors.join('\n')).toContain('profileTemplates[3].accessToken');
  });

  it('una referencia inexistente rechaza el archivo antes de borrar', async () => {
    const d = cvData();
    (d['profileTemplates'] as Mutable[])[0]['includeRefs'] = ['project:no-existe'];
    const { prisma, calls } = fakePrisma();
    const code = await executeSeed(prisma, d, { guarded: true, env: {}, ...quiet });
    expect(code).toBe(1);
    expect(calls.filter((c) => c.method === 'deleteMany')).toEqual([]);
  });
});

describe('executeSeed · negativa con --file (D6)', () => {
  const okEnv = {
    SEED_DISPOSABLE_DB: '1',
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://u:pw@h:5434/portfolio',
  };

  it('sin SEED_DISPOSABLE_DB: código 2 sin tocar la base', async () => {
    const errors: string[] = [];
    const { prisma, calls } = fakePrisma();
    const code = await executeSeed(prisma, cvData(), {
      guarded: true,
      env: { NODE_ENV: 'test', DATABASE_URL: 'postgresql://u:pw@h:5434/portfolio' },
      log: () => undefined,
      error: (m) => errors.push(m),
    });
    expect(code).toBe(2);
    expect(calls).toEqual([]);
    expect(errors.join('\n')).toContain('h:5434/portfolio');
    expect(errors.join('\n')).not.toContain('pw');
  });

  it('NODE_ENV=production: código 2 sin tocar la base', async () => {
    const { prisma, calls } = fakePrisma();
    const code = await executeSeed(prisma, cvData(), {
      guarded: true,
      env: { ...okEnv, NODE_ENV: 'production' },
      ...quiet,
    });
    expect(code).toBe(2);
    expect(calls).toEqual([]);
  });

  it('base con el perfil de otra persona: código 2, solo se lee y no se escribe', async () => {
    const { prisma, calls } = fakePrisma({ 'profile.findMany': [{ fullName: 'Otra Persona' }] });
    const code = await executeSeed(prisma, cvData(), { guarded: true, env: okEnv, ...quiet });
    expect(code).toBe(2);
    expect(calls.map((c) => `${c.model}.${c.method}`)).toEqual(['profile.findMany']);
  });

  it('base vacía: carga', async () => {
    const { prisma, calls } = fakePrisma({ 'profile.findMany': [] });
    const code = await executeSeed(prisma, cvData(), { guarded: true, env: okEnv, ...quiet });
    expect(code).toBe(0);
    expect(writes(calls)).toHaveLength(LEGACY_CALLS);
  });

  it('recarga del mismo perfil: carga', async () => {
    const fullName = (cvData()['profile'] as Mutable)['fullName'];
    const { prisma } = fakePrisma({ 'profile.findMany': [{ fullName }] });
    const code = await executeSeed(prisma, cvData(), { guarded: true, env: okEnv, ...quiet });
    expect(code).toBe(0);
  });
});

describe('executeSeed · formato extendido (D3, D7, D8)', () => {
  const now = new Date('2026-10-27T15:00:00.000Z');

  function extended(): Mutable {
    const d = cvData();
    const exps = d['experiences'] as Mutable[];
    exps[1]['visible'] = false;
    const t = (d['profileTemplates'] as Mutable[])[0];
    t['excludeRefs'] = [`experience:${String(exps[0]['id'])}`];
    t['includeRefs'] = [`experience:${String(exps[1]['id'])}`];
    t['sectionsHidden'] = ['stats'];
    t['slugAliases'] = ['nombre-anterior'];
    t['archived'] = true;
    t['theme'] = 'elegant';
    t['layout'] = 'sidebar';
    t['visibility'] = 'PROTECTED';
    t['accessToken'] = 'token-de-prueba';
    t['sectionsOrder'] = [...SECTION_IDS].reverse();
    t['listed'] = false;
    d['exampleViews'] = [
      {
        slug: t['slug'],
        count: 7,
        daysBack: 3,
        locales: ['es', 'en'],
        referrers: [null, 'https://x.example.com'],
      },
    ];
    return d;
  }

  it('traduce las referencias a los ids generados y aplica los mecanismos', async () => {
    const { prisma, calls } = fakePrisma();
    const code = await executeSeed(prisma, extended(), { guarded: false, env: {}, now, ...quiet });
    expect(code).toBe(0);

    const expCreates = calls.filter((c) => c.model === 'experience' && c.method === 'create');
    const hiddenExp = (expCreates[1].args as { data: Mutable }).data;
    expect(hiddenExp['visible']).toBe(false);

    const first = calls.find((c) => c.model === 'curatedProfile' && c.method === 'create');
    const data = (first?.args as { data: Mutable }).data;
    expect(data['excludeIds']).toEqual([
      'experience-' + (writes(calls).indexOf(expCreates[0]) + 1),
    ]);
    expect(data['includeIds']).toEqual([
      'experience-' + (writes(calls).indexOf(expCreates[1]) + 1),
    ]);
    expect(data['sectionsHidden']).toEqual(['stats']);
    expect(data['slugAliases']).toEqual({ create: [{ slug: 'nombre-anterior' }] });
    expect(data['archivedAt']).toEqual(now);
    expect(data['layout']).toBe('sidebar');
    expect(data['visibility']).toBe('PROTECTED');
    expect(data['accessToken']).toBe('token-de-prueba');
    expect(data['listed']).toBe(false);
    expect(data['sectionsOrder']).toEqual([...SECTION_IDS].reverse());
    const themeCalls = calls.filter((c) => c.model === 'theme' && c.method === 'create');
    const elegant = themeCalls.findIndex(
      (c) => (c.args as { data: Mutable }).data['slug'] === 'elegant',
    );
    expect(data['themeId']).toBe('theme-' + (writes(calls).indexOf(themeCalls[elegant]) + 1));
  });

  it('crea las visitas sintéticas en un solo createMany y actualiza views', async () => {
    const { prisma, calls } = fakePrisma();
    await executeSeed(prisma, extended(), { guarded: false, env: {}, now, ...quiet });
    const many = calls.filter((c) => c.model === 'profileView' && c.method === 'createMany');
    expect(many).toHaveLength(1);
    const rows = (many[0].args as { data: Mutable[] }).data;
    expect(rows).toHaveLength(7);
    expect(rows[0]).toMatchObject({ userAgent: 'example-seed', ipHash: null, locale: 'es' });
    const update = calls.find((c) => c.model === 'curatedProfile' && c.method === 'update');
    expect((update?.args as { data: Mutable }).data).toEqual({ views: { increment: 7 } });
  });

  it('resuelve las referencias a skills consultando los ids por nombre', async () => {
    const d = cvData();
    const skill = ((d['skillCategories'] as Mutable[])[0]['skills'] as string[])[0];
    (d['profileTemplates'] as Mutable[])[0]['excludeRefs'] = [`skill:${skill}`];
    const { prisma, calls } = fakePrisma({ 'skill.findMany': [{ id: 'cuid-skill', name: skill }] });
    expect(await executeSeed(prisma, d, { guarded: false, env: {}, ...quiet })).toBe(0);
    const first = calls.find((c) => c.model === 'curatedProfile' && c.method === 'create');
    expect((first?.args as { data: Mutable }).data['excludeIds']).toEqual(['cuid-skill']);
  });
});

describe('parseSeedArgs y readSeedFile (D5)', () => {
  const cwd = path.resolve('/trabajo/backend');

  it('sin argumentos usa la fuente por defecto', () => {
    expect(parseSeedArgs([], cwd)).toEqual({ ok: true, value: { overwrite: false } });
  });

  it('resuelve --file contra el directorio actual', () => {
    const r = parseSeedArgs(['--file', '../docs/otro.json'], cwd);
    expect(r).toEqual({
      ok: true,
      value: { overwrite: false, file: path.resolve(cwd, '../docs/otro.json') },
    });
    expect(parseSeedArgs(['--file=x.json'], cwd)).toEqual({
      ok: true,
      value: { overwrite: false, file: path.resolve(cwd, 'x.json') },
    });
  });

  it('rechaza --file sin ruta y argumentos desconocidos', () => {
    expect(parseSeedArgs(['--file'], cwd).ok).toBe(false);
    expect(parseSeedArgs(['--file', '--otra'], cwd).ok).toBe(false);
    expect(parseSeedArgs(['--nada'], cwd).ok).toBe(false);
  });

  it('acepta --overwrite sin valor y rechaza --overwrite=x', () => {
    expect(parseSeedArgs(['--overwrite'], cwd)).toEqual({ ok: true, value: { overwrite: true } });
    const r = parseSeedArgs(['--overwrite=x'], cwd);
    expect(r.ok ? '' : r.error).toContain('argumento desconocido');
  });

  it('--overwrite con --file es un error de uso, en los dos órdenes (D5)', () => {
    for (const argv of [
      ['--overwrite', '--file', 'x.json'],
      ['--file', 'x.json', '--overwrite'],
    ]) {
      const r = parseSeedArgs(argv, cwd);
      expect(r.ok).toBe(false);
      expect(r.ok ? '' : r.error).toBe(
        '--overwrite no se combina con --file: un archivo alternativo tiene su propia negativa (ver docs/DATA-POPULATION.md § 11).',
      );
    }
  });

  it('una ruta inexistente es un error de lectura, antes de conectarse', () => {
    const r = readSeedFile(path.resolve(__dirname, 'no-existe.json'));
    expect(r.ok).toBe(false);
    expect(r.ok ? '' : r.error).toContain('no existe el archivo');
  });

  it('un JSON roto es un error de lectura', () => {
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'seed-')), 'roto.json');
    fs.writeFileSync(tmp, '{ no es json');
    const r = readSeedFile(tmp);
    expect(r.ok).toBe(false);
    expect(r.ok ? '' : r.error).toContain('no es JSON válido');
  });

  it('lee docs/cv-data.json', () => {
    expect(readSeedFile(cvDataPath).ok).toBe(true);
  });
});

describe('executeSeed · negativa del seed por defecto (protect-default-seed)', () => {
  const url = 'postgresql://portfolio:s3cr3t-pass@localhost:5434/portfolio?schema=public';
  const withContent = {
    'experience.count': 15,
    'curatedProfile.count': 14,
    'profileView.count': 230,
  };
  const run = async (
    responses: Record<string, unknown>,
    env: Record<string, string | undefined>,
    overwrite = false,
  ) => {
    const out: string[] = [];
    const { prisma, calls } = fakePrisma(responses);
    const code = await executeSeed(prisma, cvData(), {
      guarded: false,
      overwrite,
      env: { DATABASE_URL: url, ...env },
      now: new Date(2026, 9, 27, 12),
      log: (m) => out.push(m),
      error: (m) => out.push(m),
    });
    return { code, calls, text: out.join('\n') };
  };
  const countsOnly = (calls: Call[]): boolean =>
    calls.length === 13 && calls.every((c) => c.method === 'count');

  it('base con contenido sin flag: código 2, solo los 13 count y el mensaje completo', async () => {
    const { code, calls, text } = await run(withContent, {});
    expect(code).toBe(2);
    expect(countsOnly(calls)).toBe(true);
    expect(text).toContain('localhost:5434/portfolio');
    expect(text).toContain('  - ProfileView: 230');
    expect(text).toContain('  - Experience: 15');
    expect(text).toContain('pg_dump "postgresql://portfolio@localhost:5434/portfolio" -Fc');
    expect(text).toContain('npm run seed -- --overwrite');
    expect(text).toContain('No se escribió nada.');
    expect(text).not.toContain('s3cr3t-pass');
  });

  it('--overwrite local: código 0, avisa y escribe lo de la instantánea', async () => {
    const { code, calls, text } = await run(withContent, {}, true);
    expect(code).toBe(0);
    expect(text).toContain('--overwrite: se borra el contenido de localhost:5434/portfolio');
    expect(writes(calls)).toHaveLength(LEGACY_CALLS);
    const digest = crypto
      .createHash('sha256')
      .update(JSON.stringify(writes(calls)))
      .digest('hex');
    expect(digest).toBe(LEGACY_SHA256);
  });

  it('base vacía con --overwrite: carga sin aviso', async () => {
    const { code, text } = await run({}, {}, true);
    expect(code).toBe(0);
    expect(text).not.toContain('se borra el contenido');
  });

  it('producción con la base vacía: código 0', async () => {
    expect((await run({}, { NODE_ENV: 'production' })).code).toBe(0);
  });

  it('producción con contenido: sin --overwrite, solo --overwrite o solo la variable, código 2', async () => {
    const cases: [boolean, Record<string, string>][] = [
      [false, { NODE_ENV: 'production' }],
      [true, { NODE_ENV: 'production' }],
      [false, { NODE_ENV: 'production', SEED_ALLOW_PRODUCTION: '1' }],
    ];
    for (const [overwrite, env] of cases) {
      const { code, calls, text } = await run(withContent, env, overwrite);
      expect(code).toBe(2);
      expect(countsOnly(calls)).toBe(true);
      expect(text).toContain('(NODE_ENV=production)');
    }
    const missing = await run(withContent, { NODE_ENV: 'production' }, true);
    expect(missing.text).toContain('falta SEED_ALLOW_PRODUCTION=1');
  });

  it('producción con las dos llaves: código 0 con la marca de producción', async () => {
    const { code, text, calls } = await run(
      withContent,
      { NODE_ENV: 'production', SEED_ALLOW_PRODUCTION: '1' },
      true,
    );
    expect(code).toBe(0);
    expect(text).toContain('--overwrite en producción (SEED_ALLOW_PRODUCTION=1)');
    expect(writes(calls)).toHaveLength(LEGACY_CALLS);
  });

  it('un count que falla: código 1, sin escrituras y sin la contraseña (D6)', async () => {
    const err = new Error(
      'The table `public.ProfileView` does not exist (postgresql://portfolio:s3cr3t-pass@localhost:5434/portfolio)',
    );
    const { code, calls, text } = await run({ 'profileView.count': err }, {}, true);
    expect(code).toBe(1);
    expect(writes(calls)).toEqual([]);
    expect(text).toContain('public.ProfileView');
    expect(text).toContain('No se escribió nada.');
    expect(text).not.toContain('s3cr3t-pass');
  });

  it('un count que falla a mitad de camino tampoco escribe', async () => {
    const { code, calls } = await run({ 'project.count': new Error('conexión perdida') }, {});
    expect(code).toBe(1);
    expect(calls.some((c) => c.method === 'deleteMany')).toBe(false);
  });

  it('con --file no se cuenta nada', async () => {
    const { prisma, calls } = fakePrisma({ 'profile.findMany': [] });
    await executeSeed(prisma, cvData(), {
      guarded: true,
      env: { SEED_DISPOSABLE_DB: '1', NODE_ENV: 'test' },
      ...quiet,
    });
    expect(calls.some((c) => c.method === 'count')).toBe(false);
  });
});

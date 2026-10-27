import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SECTION_IDS } from '../src/modules/curated-profile/domain/services/resolve-sections';
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

/** Cliente simulado: registra cada llamada y devuelve `{ id: "<modelo>-<n>" }`, como el harness de la instantánea. */
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
                counter += 1;
                return Promise.resolve(
                  responses[`${model}.${method}`] ?? { id: `${model}-${counter}` },
                );
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
const LEGACY_SHA256 = '24ef8090282a3a9e486ebd7fef0c268ecfbf2c394a21e3910540f37fc26c9922';

describe('executeSeed · seed por defecto (sin --file)', () => {
  it('escribe exactamente lo mismo que antes del formato extendido', async () => {
    const { prisma, calls } = fakePrisma();
    const code = await executeSeed(prisma, cvData(), { guarded: false, env: {}, ...quiet });
    expect(code).toBe(0);
    expect(calls).toHaveLength(LEGACY_CALLS);
    const digest = crypto.createHash('sha256').update(JSON.stringify(calls)).digest('hex');
    expect(digest).toBe(LEGACY_SHA256);
  });

  it('no exige SEED_DISPOSABLE_DB ni consulta la base antes de escribir', async () => {
    const { prisma, calls } = fakePrisma();
    await executeSeed(prisma, cvData(), { guarded: false, env: {}, ...quiet });
    expect(calls[0].method).toBe('deleteMany');
    expect(calls.some((c) => c.method === 'findMany')).toBe(false);
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
    expect(data['excludeIds']).toEqual(['experience-' + (calls.indexOf(expCreates[0]) + 1)]);
    expect(data['includeIds']).toEqual(['experience-' + (calls.indexOf(expCreates[1]) + 1)]);
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
    expect(data['themeId']).toBe('theme-' + (calls.indexOf(themeCalls[elegant]) + 1));
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
    expect(parseSeedArgs([], cwd)).toEqual({ ok: true, value: {} });
  });

  it('resuelve --file contra el directorio actual', () => {
    const r = parseSeedArgs(['--file', '../docs/otro.json'], cwd);
    expect(r).toEqual({ ok: true, value: { file: path.resolve(cwd, '../docs/otro.json') } });
    expect(parseSeedArgs(['--file=x.json'], cwd)).toEqual({
      ok: true,
      value: { file: path.resolve(cwd, 'x.json') },
    });
  });

  it('rechaza --file sin ruta y argumentos desconocidos', () => {
    expect(parseSeedArgs(['--file'], cwd).ok).toBe(false);
    expect(parseSeedArgs(['--file', '--otra'], cwd).ok).toBe(false);
    expect(parseSeedArgs(['--nada'], cwd).ok).toBe(false);
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

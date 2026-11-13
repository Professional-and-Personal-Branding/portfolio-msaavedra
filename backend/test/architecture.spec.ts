/**
 * Test de arquitectura: hace verificable la regla de dependencia de CLAUDE.md.
 *   domain      → no importa @nestjs/*, @prisma/client ni nada de infrastructure/application
 *   application → no importa @prisma/client ni infrastructure
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '../src');

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [full] : [];
  });
}

function importsOf(file: string): string[] {
  const source = fs.readFileSync(file, 'utf-8');
  const regex = /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/g;
  const found: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) found.push(match[1]);
  return found;
}

function filesIn(layer: 'domain' | 'application'): string[] {
  const moduleDirs = fs.existsSync(path.join(SRC, 'modules'))
    ? fs
        .readdirSync(path.join(SRC, 'modules'), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => path.join(SRC, 'modules', d.name, layer))
    : [];
  const shared =
    layer === 'domain'
      ? [path.join(SRC, 'shared', 'domain')]
      : [path.join(SRC, 'shared', 'application')];
  return [...moduleDirs, ...shared].flatMap(walk);
}

function violations(files: string[], forbidden: RegExp[]): string[] {
  return files.flatMap((file) =>
    importsOf(file)
      .filter((imp) => forbidden.some((rule) => rule.test(imp)))
      .map((imp) => `${path.relative(SRC, file)} → ${imp}`),
  );
}

describe('Regla de dependencia (Clean Architecture)', () => {
  it('existen archivos de dominio y aplicación que auditar', () => {
    expect(filesIn('domain').length).toBeGreaterThan(0);
    expect(filesIn('application').length).toBeGreaterThan(0);
  });

  it('domain no depende de NestJS, Prisma, application ni infrastructure', () => {
    const found = violations(filesIn('domain'), [
      /^@nestjs\//,
      /^@prisma\/client/,
      /(^|\/)infrastructure(\/|$)/,
      /(^|\/)application(\/|$)/,
    ]);
    expect(found).toEqual([]);
  });

  it('application no depende de Prisma ni de infrastructure', () => {
    const found = violations(filesIn('application'), [
      /^@prisma\/client/,
      /(^|\/)infrastructure(\/|$)/,
    ]);
    expect(found).toEqual([]);
  });

  // add-share-links (D10): cada módulo escribe solo su agregado y la dependencia va en un sentido.
  it('curated-profile no importa nada de analytics/infrastructure', () => {
    const files = walk(path.join(SRC, 'modules', 'curated-profile'));
    expect(files.length).toBeGreaterThan(0);
    expect(violations(files, [/analytics\/infrastructure/])).toEqual([]);
  });

  it('analytics lee ShareLink pero nunca lo escribe', () => {
    const files = walk(path.join(SRC, 'modules', 'analytics'));
    const writers = files.filter((file) =>
      /\.shareLink\.(create|createMany|update|updateMany|upsert|delete|deleteMany)/.test(
        fs.readFileSync(file, 'utf-8'),
      ),
    );
    expect(writers.map((file) => path.relative(SRC, file))).toEqual([]);
  });

  // add-integrations-foundation (D1): la ruta pública no depende de las integraciones.
  it.each(['curated-profile', 'profile', 'analytics'])(
    'modules/%s no importa nada de modules/integrations',
    (name) => {
      const files = walk(path.join(SRC, 'modules', name));
      expect(files.length).toBeGreaterThan(0);
      expect(
        violations(files, [/(^|\/)modules\/integrations(\/|$)/, /(^|\/)integrations\//]),
      ).toEqual([]);
    },
  );

  it('el composer del perfil curado no importa de integrations', () => {
    const composer = walk(path.join(SRC, 'modules', 'curated-profile')).filter((file) =>
      /composer/i.test(path.basename(file)),
    );
    expect(composer.length).toBeGreaterThan(0);
    expect(violations(composer, [/integrations/])).toEqual([]);
  });

  it('el detector realmente detecta un import prohibido (autocontrol)', () => {
    const tmp = path.join(__dirname, '__arch_probe__.ts');
    fs.writeFileSync(
      tmp,
      "import { PrismaClient } from '@prisma/client';\nexport const x = PrismaClient;\n",
    );
    try {
      expect(violations([tmp], [/^@prisma\/client/])).toHaveLength(1);
    } finally {
      fs.unlinkSync(tmp);
    }
  });
});

// D16: ningún fixture versionado puede contener un token con forma de credencial real.
describe('Fixtures sin tokens (riesgo «Se filtra un token»)', () => {
  const FIXTURE_DIRS = [
    path.resolve(__dirname, 'fixtures'),
    path.resolve(__dirname, '../../docs/fixtures'),
  ];
  const TOKEN = /(?:ghp_|github_pat_|sk-ant-)[A-Za-z0-9_-]{20,}/;

  function allFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? allFiles(full) : [full];
    });
  }

  it('hay fixtures que escanear', () => {
    expect(FIXTURE_DIRS.flatMap(allFiles).length).toBeGreaterThan(0);
  });

  it('ninguno contiene ghp_, github_pat_ o sk-ant- seguidos de 20 o más caracteres', () => {
    const leaks = FIXTURE_DIRS.flatMap(allFiles).filter((file) =>
      TOKEN.test(fs.readFileSync(file, 'utf-8')),
    );
    expect(leaks.map((file) => path.relative(path.resolve(__dirname, '../..'), file))).toEqual([]);
  });

  it('el detector detecta un token de ejemplo (autocontrol)', () => {
    expect(TOKEN.test(`ghp_${'a'.repeat(36)}`)).toBe(true);
    expect(TOKEN.test(`github_pat_${'B'.repeat(30)}`)).toBe(true);
    expect(TOKEN.test(`sk-ant-api03-${'c'.repeat(30)}`)).toBe(true);
    expect(TOKEN.test('ghp_corto')).toBe(false);
  });
});

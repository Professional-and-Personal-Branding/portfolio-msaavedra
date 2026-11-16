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
  // add-github-code-evidence (D2): `featured-repository` también lee la evidencia de la base y no
  // conoce al conector que la escribe.
  it.each(['curated-profile', 'profile', 'analytics', 'featured-repository'])(
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

  // add-github-code-evidence (D2): solo el almacén del conector `github` escribe RepositoryEvidence
  // (el borrado en cascada lo hace la base al borrar el repositorio destacado).
  const WRITES_REPOSITORY_EVIDENCE =
    /\.repositoryEvidence\.(create|createMany|update|updateMany|upsert|delete|deleteMany)/;
  const EVIDENCE_WRITER = 'prisma-code-evidence.store.ts';

  const evidenceWriters = (files: string[]): string[] =>
    files
      .filter((file) => WRITES_REPOSITORY_EVIDENCE.test(fs.readFileSync(file, 'utf-8')))
      .filter((file) => path.basename(file) !== EVIDENCE_WRITER)
      .map((file) => path.relative(SRC, file));

  it('solo prisma-code-evidence.store.ts escribe repositoryEvidence', () => {
    const files = walk(SRC);
    expect(files.some((file) => path.basename(file) === EVIDENCE_WRITER)).toBe(true);
    expect(evidenceWriters(files)).toEqual([]);
  });

  it('el escritor permitido existe y realmente escribe (la regla no está vacía)', () => {
    const store = walk(SRC).find((file) => path.basename(file) === EVIDENCE_WRITER);
    expect(store).toBeDefined();
    expect(WRITES_REPOSITORY_EVIDENCE.test(fs.readFileSync(store as string, 'utf-8'))).toBe(true);
  });

  it('autocontrol: la regla detecta un escritor de ejemplo y deja pasar una lectura', () => {
    const probe = path.join(__dirname, '__arch_probe_evidence__.ts');
    fs.writeFileSync(
      probe,
      'export const f = (prisma: unknown) => prisma.repositoryEvidence.upsert({});\n',
    );
    try {
      expect(evidenceWriters([probe])).toHaveLength(1);
    } finally {
      fs.unlinkSync(probe);
    }
    fs.writeFileSync(
      probe,
      'export const f = (prisma: unknown) => prisma.repositoryEvidence.findUnique({});\n',
    );
    try {
      expect(evidenceWriters([probe])).toEqual([]);
    } finally {
      fs.unlinkSync(probe);
    }
  });

  // add-job-posting-intake (D19): `job-posting` sugiere y `curated-profile` crea; la dependencia
  // va en un sentido y por el puerto de lectura.
  const WRITES_CURATED_PROFILE =
    /\.curatedProfile\.(create|createMany|update|updateMany|upsert|delete|deleteMany)/;

  /** Regla 1: nada de `job-posting` importa una ruta de `curated-profile/`. */
  const jobPostingImportsCuratedProfile = (files: string[]): string[] =>
    violations(files, [/curated-profile\//]);

  /** Regla 2: nada de `job-posting` escribe `CuratedProfile`. */
  const jobPostingWritesCuratedProfile = (files: string[]): string[] =>
    files
      .filter((file) => WRITES_CURATED_PROFILE.test(fs.readFileSync(file, 'utf-8')))
      .map((file) => path.relative(SRC, file));

  const JOB_POSTING_PORTS = /(^|\/)job-posting\/application\/ports\//;
  const JOB_POSTING_MODULE = /(^|\/)job-posting\/job-posting\.module$/;
  const FROM_POSTING_USE_CASE = 'create-curated-profile-from-job-posting.use-case.ts';

  /** Regla 3: `curated-profile` solo importa de `job-posting/` los puertos (y el módulo, desde su módulo). */
  const curatedProfileImportsMoreThanPorts = (files: string[]): string[] =>
    files.flatMap((file) =>
      importsOf(file)
        .filter((imp) => /(^|\/)job-posting\//.test(imp))
        .filter(
          (imp) =>
            !JOB_POSTING_PORTS.test(imp) &&
            !(path.basename(file) === 'curated-profile.module.ts' && JOB_POSTING_MODULE.test(imp)),
        )
        .map((imp) => `${path.relative(SRC, file)} → ${imp}`),
    );

  /** Regla 4: fuera de su módulo y del caso de uso del borrador, nadie de `curated-profile` importa `job-posting/`. */
  const curatedProfileImportsJobPostingOutsideAllowed = (files: string[]): string[] =>
    violations(
      files.filter(
        (file) =>
          path.basename(file) !== 'curated-profile.module.ts' &&
          path.basename(file) !== FROM_POSTING_USE_CASE,
      ),
      [/(^|\/)job-posting(\/|$)/],
    );

  const jobPostingFiles = (): string[] => walk(path.join(SRC, 'modules', 'job-posting'));
  const curatedProfileFiles = (): string[] => walk(path.join(SRC, 'modules', 'curated-profile'));

  it('job-posting no importa nada de curated-profile (regla 1)', () => {
    expect(jobPostingFiles().length).toBeGreaterThan(0);
    expect(jobPostingImportsCuratedProfile(jobPostingFiles())).toEqual([]);
  });

  it('job-posting no escribe CuratedProfile (regla 2)', () => {
    expect(jobPostingWritesCuratedProfile(jobPostingFiles())).toEqual([]);
  });

  it('curated-profile solo importa de job-posting su puerto de lectura (regla 3)', () => {
    expect(curatedProfileFiles().length).toBeGreaterThan(0);
    expect(curatedProfileImportsMoreThanPorts(curatedProfileFiles())).toEqual([]);
  });

  it('solo el módulo y el caso de uso del borrador de curated-profile importan job-posting (regla 4)', () => {
    expect(curatedProfileImportsJobPostingOutsideAllowed(curatedProfileFiles())).toEqual([]);
  });

  describe('autocontrol de las reglas de job-posting', () => {
    const withProbe = (
      name: string,
      body: string,
      check: (files: string[]) => string[],
    ): string[] => {
      const tmp = path.join(__dirname, name);
      fs.writeFileSync(tmp, body);
      try {
        return check([tmp]);
      } finally {
        fs.unlinkSync(tmp);
      }
    };

    it('la regla 1 detecta un import de curated-profile', () => {
      const found = withProbe(
        '__arch_probe_jp1__.ts',
        "import { X } from '../src/modules/curated-profile/domain/entities/curated-profile.entity';\nexport const x = X;\n",
        jobPostingImportsCuratedProfile,
      );
      expect(found).toHaveLength(1);
    });

    it('la regla 2 detecta una escritura de CuratedProfile', () => {
      const found = withProbe(
        '__arch_probe_jp2__.ts',
        'export const f = (prisma: unknown) => prisma.curatedProfile.create({});\n',
        jobPostingWritesCuratedProfile,
      );
      expect(found).toHaveLength(1);
    });

    it('la regla 3 detecta un import de job-posting que no es un puerto', () => {
      const found = withProbe(
        '__arch_probe_jp3__.ts',
        "import { X } from '../src/modules/job-posting/domain/entities/job-posting.entity';\nexport const x = X;\n",
        curatedProfileImportsMoreThanPorts,
      );
      expect(found).toHaveLength(1);
    });

    it('la regla 3 acepta un puerto', () => {
      const found = withProbe(
        '__arch_probe_jp3b__.ts',
        "import { X } from '../src/modules/job-posting/application/ports/job-posting.reader';\nexport const x = X;\n",
        curatedProfileImportsMoreThanPorts,
      );
      expect(found).toEqual([]);
    });

    it('la regla 4 detecta un import de job-posting fuera de los dos archivos permitidos', () => {
      const found = withProbe(
        '__arch_probe_jp4__.ts',
        "import { X } from '../src/modules/job-posting/application/ports/job-posting.reader';\nexport const x = X;\n",
        curatedProfileImportsJobPostingOutsideAllowed,
      );
      expect(found).toHaveLength(1);
    });
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

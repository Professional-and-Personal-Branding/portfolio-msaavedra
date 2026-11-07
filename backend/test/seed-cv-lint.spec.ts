import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  CV_LINT_EXIT_ERRORS,
  CV_LINT_EXIT_INVALID_INPUT,
  CV_LINT_EXIT_OK,
  CvLintOptions,
  executeCvLint,
  parseCvLintArgs,
} from '../scripts/lib/cv-lint-runner';
import { DEFAULT_SEED_FILE } from '../scripts/lib/seed-file';

const EXAMPLE = path.resolve(__dirname, '../../docs/examples/cv-data.example.json');
const NOW = new Date('2026-11-07T12:00:00Z');

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, io: { log: (m: string) => out.push(m), error: (m: string) => err.push(m) } };
}

describe('cv:lint (D13)', () => {
  let dir: string;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-lint-'));
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  const base = (): Record<string, unknown> =>
    JSON.parse(fs.readFileSync(EXAMPLE, 'utf-8')) as Record<string, unknown>;
  const write = (name: string, content: unknown): string => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
    return file;
  };
  const options = (file: string, extra: Partial<CvLintOptions> = {}): CvLintOptions => ({
    file,
    asOf: '2026-11',
    locale: 'es',
    format: 'text',
    ...extra,
  });

  describe('parseCvLintArgs', () => {
    it('sin argumentos: el archivo del owner, mes UTC actual, español y texto', () => {
      const r = parseCvLintArgs([], '/x', NOW);
      expect(r).toEqual({
        ok: true,
        value: { file: DEFAULT_SEED_FILE, asOf: '2026-11', locale: 'es', format: 'text' },
      });
    });

    it('acepta las cuatro opciones, también con =', () => {
      const r = parseCvLintArgs(
        ['--file', 'a.json', '--as-of=2027-02', '--locale', 'en', '--format=json'],
        path.resolve('/base'),
        NOW,
      );
      expect(r).toEqual({
        ok: true,
        value: {
          file: path.resolve('/base', 'a.json'),
          asOf: '2027-02',
          locale: 'en',
          format: 'json',
        },
      });
    });

    it.each([
      [['--nope']],
      [['--file']],
      [['--as-of', '2026-13']],
      [['--as-of', 'hoy']],
      [['--locale', 'fr']],
      [['--format', 'xml']],
    ])('rechaza %j', (argv) => {
      expect(parseCvLintArgs(argv, '/x', NOW).ok).toBe(false);
    });
  });

  it('la copia del ejemplo con un error sembrado: imprime la clave del ítem y sale con 1', () => {
    const data = base() as { experiences: Array<Record<string, unknown>> };
    data.experiences[1].current = true;
    data.experiences[1].endDate = '2024-05';
    const { out, io } = capture();
    const code = executeCvLint(options(write('roto.json', data)), io);
    expect(code).toBe(CV_LINT_EXIT_ERRORS);
    const line = out.find((l) => l.startsWith('ERROR date.ongoing-with-end'));
    expect(line).toBe(
      `ERROR date.ongoing-with-end experience experience:${String(data.experiences[1].id)}: Está marcada como actual y además tiene fecha de fin (2024-05).`,
    );
    expect(out[out.length - 1]).toMatch(/^Resumen \(al 2026-11\): 1 error · /);
  });

  it('solo avisos y sugerencias: sale con 0 y los imprime', () => {
    const { out, io } = capture();
    const code = executeCvLint(options(EXAMPLE), io);
    expect(code).toBe(CV_LINT_EXIT_OK);
    expect(
      out.some((l) =>
        l.startsWith('WARNING i18n.missing-translation curatedProfile ejemplo-borrador'),
      ),
    ).toBe(true);
    expect(
      out.some((l) => l.startsWith('INFO certification.expired certification certification#1')),
    ).toBe(true);
  });

  it('el aviso de años no cambia el código de salida', () => {
    const data = base() as { profile: { yearsOfExperience: number } };
    data.profile.yearsOfExperience = 30;
    const { out, io } = capture();
    expect(executeCvLint(options(write('anios.json', data)), io)).toBe(CV_LINT_EXIT_OK);
    expect(
      out.some((l) => l.startsWith('WARNING profile.years-mismatch profile profile: Declarás 30')),
    ).toBe(true);
  });

  it('el docs/cv-data.json del owner no tiene errores', () => {
    const { io } = capture();
    expect(executeCvLint(options(DEFAULT_SEED_FILE), io)).toBe(CV_LINT_EXIT_OK);
  });

  it('ruta inexistente: sale con 2 sin correr reglas', () => {
    const { out, err, io } = capture();
    const code = executeCvLint(options(path.join(dir, 'no-existe.json')), io);
    expect(code).toBe(CV_LINT_EXIT_INVALID_INPUT);
    expect(out).toEqual([]);
    expect(err[0]).toMatch(/no existe el archivo/);
  });

  it('JSON inválido: sale con 2', () => {
    const { err, io } = capture();
    expect(executeCvLint(options(write('mal.json', '{ no es json')), io)).toBe(
      CV_LINT_EXIT_INVALID_INPUT,
    );
    expect(err[0]).toMatch(/no es JSON válido/);
  });

  it('JSON que el parser del seed rechaza: imprime sus errores y sale con 2', () => {
    const data = base() as { experiences: Array<Record<string, unknown>> };
    delete data.experiences[0].company;
    const { out, err, io } = capture();
    const code = executeCvLint(options(write('incompleto.json', data)), io);
    expect(code).toBe(CV_LINT_EXIT_INVALID_INPUT);
    expect(out).toEqual([]);
    expect(err[0]).toMatch(/no cumple el formato del seed/);
    expect(err[0]).toMatch(/experiences\[0\]/);
  });

  it('--format json imprime { asOf, experience, summary, issues } como el endpoint', () => {
    const { out, io } = capture();
    executeCvLint(options(EXAMPLE, { format: 'json' }), io);
    expect(out).toHaveLength(1);
    const report = JSON.parse(out[0]) as Record<string, unknown>;
    expect(Object.keys(report)).toEqual(['asOf', 'experience', 'summary', 'issues']);
    expect(report.asOf).toBe('2026-11');
    expect(report.experience).toEqual({ declaredYears: 11, derivedMonths: 143 });
    const issues = report.issues as Array<Record<string, unknown>>;
    expect(Object.keys(issues[0])).toEqual([
      'code',
      'severity',
      'entityType',
      'entityId',
      'entityLabel',
      'field',
      'message',
      'params',
    ]);
  });

  it('--locale en traduce los mensajes y no cambia los códigos', () => {
    const es = capture();
    const en = capture();
    executeCvLint(options(EXAMPLE), es.io);
    executeCvLint(options(EXAMPLE, { locale: 'en' }), en.io);
    const codes = (lines: string[]) =>
      lines.slice(0, -1).map((l) => l.split(' ').slice(0, 4).join(' '));
    expect(codes(en.out)).toEqual(codes(es.out));
    expect(en.out.some((l) => l.includes('Expired in 2025-12'))).toBe(true);
    expect(en.out[en.out.length - 1]).toMatch(/^Summary \(as of 2026-11\)/);
  });

  it('el ejemplo declara 11 años: sin aviso con 143 meses (2026-11) y con aviso desde 2026-12', () => {
    const november = capture();
    expect(executeCvLint(options(EXAMPLE, { asOf: '2026-11' }), november.io)).toBe(CV_LINT_EXIT_OK);
    expect(november.out.some((l) => l.startsWith('WARNING profile.years-mismatch'))).toBe(false);
    const december = capture();
    expect(executeCvLint(options(EXAMPLE, { asOf: '2026-12' }), december.io)).toBe(CV_LINT_EXIT_OK);
    expect(december.out.some((l) => l.startsWith('WARNING profile.years-mismatch'))).toBe(true);
  });

  it('no importa @prisma/client ni lee DATABASE_URL', () => {
    for (const file of [
      'cv-lint.ts',
      'lib/cv-lint-runner.ts',
      'lib/seed-to-cv-snapshot.ts',
      'lib/seed-file.ts',
    ]) {
      const source = fs.readFileSync(path.resolve(__dirname, '../scripts', file), 'utf-8');
      expect(source).not.toMatch(/from ['"]@prisma\/client['"]/);
      expect(source).not.toMatch(/process\.env/);
    }
  });
});

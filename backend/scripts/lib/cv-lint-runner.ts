/**
 * Núcleo de `npm run cv:lint` (D13 de `add-cv-consistency-rules`): corre las mismas reglas que el
 * panel sobre un archivo del seed, sin abrir la base. `scripts/cv-lint.ts` es solo la entrada de
 * línea de comandos; todo lo demás vive acá para poder probarlo sin infraestructura.
 *
 * Códigos de salida:
 *   0  sin errores (los avisos y las sugerencias no fallan)
 *   1  al menos un hallazgo `error`
 *   2  el archivo no existe o no es JSON, el parser del seed lo rechaza o los argumentos no sirven
 */
import * as path from 'path';
import { buildCvReport } from '../../src/modules/cv-consistency/application/build-cv-report';
import { CvConsistencyReport } from '../../src/modules/cv-consistency/application/cv-consistency.output';
import { YEAR_MONTH_REGEX } from '../../src/modules/experience/domain/services/validate-experience';
import { isSupportedLocale, Locale } from '../../src/shared/domain/i18n';
import { fail, ok, Result } from '../../src/shared/domain/result';
import { DEFAULT_SEED_FILE, readSeedFile } from './seed-file';
import { formatSeedErrors, parseSeedSource } from './seed-source';
import { seedToCvSnapshot } from './seed-to-cv-snapshot';

export const CV_LINT_EXIT_OK = 0;
export const CV_LINT_EXIT_ERRORS = 1;
export const CV_LINT_EXIT_INVALID_INPUT = 2;

export type CvLintFormat = 'text' | 'json';

export interface CvLintOptions {
  /** Ruta absoluta del archivo del seed. */
  readonly file: string;
  /** Mes de referencia `YYYY-MM`. */
  readonly asOf: string;
  readonly locale: Locale;
  readonly format: CvLintFormat;
}

/**
 * `--file <ruta>`, `--as-of AAAA-MM`, `--locale es|en` y `--format text|json` (también con `=`).
 * La ruta se resuelve contra `cwd`; `asOf` por defecto es el mes UTC de `now`.
 */
export function parseCvLintArgs(
  argv: readonly string[],
  cwd: string,
  now: Date,
): Result<CvLintOptions, string> {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const eq = arg.indexOf('=');
    const name = eq === -1 ? arg : arg.slice(0, eq);
    if (!['--file', '--as-of', '--locale', '--format'].includes(name)) {
      return fail(`argumento desconocido: ${arg}`);
    }
    let value: string | undefined;
    if (eq === -1) {
      value = argv[i + 1];
      i++;
    } else {
      value = arg.slice(eq + 1);
    }
    if (value === undefined || value === '' || value.startsWith('--')) {
      return fail(`${name} necesita un valor`);
    }
    values.set(name, value);
  }

  const asOf = values.get('--as-of') ?? now.toISOString().slice(0, 7);
  if (!YEAR_MONTH_REGEX.test(asOf)) return fail(`--as-of debe tener formato AAAA-MM: "${asOf}"`);

  const locale = values.get('--locale') ?? 'es';
  if (!isSupportedLocale(locale)) return fail(`--locale debe ser es o en: "${locale}"`);

  const format = values.get('--format') ?? 'text';
  if (format !== 'text' && format !== 'json')
    return fail(`--format debe ser text o json: "${format}"`);

  const file = values.get('--file');
  return ok({
    file: file === undefined ? DEFAULT_SEED_FILE : path.resolve(cwd, file),
    asOf,
    locale,
    format,
  });
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** Una línea por hallazgo (`SEVERIDAD código entidad id: mensaje`) y un resumen final. */
export function formatCvLintText(report: CvConsistencyReport, locale: Locale): string[] {
  const lines = report.issues.map(
    (i) => `${i.severity.toUpperCase()} ${i.code} ${i.entityType} ${i.entityId}: ${i.message}`,
  );
  const { error, warning, info } = report.summary;
  const summary =
    locale === 'es'
      ? `Resumen (al ${report.asOf}): ${plural(error, 'error', 'errores')} · ${plural(warning, 'aviso', 'avisos')} · ${plural(info, 'sugerencia', 'sugerencias')}`
      : `Summary (as of ${report.asOf}): ${plural(error, 'error', 'errors')} · ${plural(warning, 'warning', 'warnings')} · ${plural(info, 'suggestion', 'suggestions')}`;
  return [...lines, summary];
}

export interface CvLintIo {
  readonly log: (message: string) => void;
  readonly error: (message: string) => void;
}

/** Lee, valida y revisa el archivo. Devuelve el código de salida; no toca `process`. */
export function executeCvLint(options: CvLintOptions, io: CvLintIo): number {
  const raw = readSeedFile(options.file);
  if (!raw.ok) {
    io.error(`❌ ${raw.error}`);
    return CV_LINT_EXIT_INVALID_INPUT;
  }
  const parsed = parseSeedSource(raw.value);
  if (!parsed.ok) {
    io.error(
      `❌ ${options.file} no cumple el formato del seed:\n${formatSeedErrors(parsed.error)}`,
    );
    return CV_LINT_EXIT_INVALID_INPUT;
  }

  const report = buildCvReport(seedToCvSnapshot(parsed.value), options.asOf, options.locale);
  if (options.format === 'json') {
    io.log(JSON.stringify(report, null, 2));
  } else {
    for (const line of formatCvLintText(report, options.locale)) io.log(line);
  }
  return report.summary.error > 0 ? CV_LINT_EXIT_ERRORS : CV_LINT_EXIT_OK;
}

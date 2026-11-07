/**
 * Revisión de consistencia del CV sobre un archivo del seed, sin base de datos.
 *
 *   npm run cv:lint                                          → docs/cv-data.json
 *   npm run cv:lint -- --file ../docs/examples/cv-data.example.json
 *   npm run cv:lint -- --as-of 2026-11 --locale en --format json
 *
 * Corre las mismas reglas que la pantalla Revisión del panel (`GET /api/admin/consistency`).
 * No abre la base ni lee `DATABASE_URL`; nunca modifica el archivo.
 *
 * Salida: 0 sin errores (los avisos y sugerencias no fallan) · 1 con al menos un `error` ·
 * 2 archivo ausente, JSON inválido, formato del seed rechazado o argumentos inválidos.
 */
import { CV_LINT_EXIT_INVALID_INPUT, executeCvLint, parseCvLintArgs } from './lib/cv-lint-runner';

function main(): number {
  const args = parseCvLintArgs(process.argv.slice(2), process.cwd(), new Date());
  if (!args.ok) {
    console.error(`❌ ${args.error}`);
    return CV_LINT_EXIT_INVALID_INPUT;
  }
  return executeCvLint(args.value, {
    log: (message) => console.log(message),
    error: (message) => console.error(message),
  });
}

process.exitCode = main();

/**
 * Genera `src/shared/types/api.d.ts` a partir de `backend/openapi.json`
 * (spec `api-contract-types`). La cabecera incluye el SHA-256 del JSON de
 * origen; `src/shared/types/api-types.spec.ts` falla si el archivo generado
 * quedó desactualizado respecto al contrato.
 *
 * Uso: npm run api:types   (antes: `npm run openapi:export` en backend/)
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';

const here = dirname(fileURLToPath(import.meta.url));
const OPENAPI_PATH = resolve(here, '../../backend/openapi.json');
const OUTPUT_PATH = resolve(here, '../src/shared/types/api.d.ts');
const HASH_PREFIX = '// openapi-sha256: ';

function hashOpenApi(json) {
  return createHash('sha256').update(json).digest('hex');
}

async function main() {
  const source = readFileSync(OPENAPI_PATH, 'utf-8');
  const ast = await openapiTS(JSON.parse(source), { alphabetize: true });
  const body = astToString(ast);
  const header = [
    '/* eslint-disable */',
    '// Generado por `npm run api:types` desde backend/openapi.json. NO editar a mano.',
    `${HASH_PREFIX}${hashOpenApi(source)}`,
    '',
  ].join('\n');
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${header}${body}`, 'utf-8');
  console.log(`Tipos generados en ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(`[api:types] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

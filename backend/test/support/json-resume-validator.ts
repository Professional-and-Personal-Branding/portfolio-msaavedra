/**
 * Validador de JSON Resume v1.0.0 para los tests (change `add-json-resume-export`, D9).
 *
 * Compila el schema vendorizado de `test/fixtures/json-resume` con Ajv 8. El schema es draft-04 y
 * Ajv 8 no trae ese meta-schema: se compila una copia sin la clave `$schema` (las palabras clave
 * que usa se comportan igual en el dialecto por defecto) con `strict: false` por su
 * `additionalItems`. Los formatos `uri`, `email` y `date` quedan activos.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

const FIXTURE_DIR = join(__dirname, '..', 'fixtures', 'json-resume');
const SCHEMA_PATH = join(FIXTURE_DIR, 'schema-v1.0.0.json');
const SOURCE_PATH = join(FIXTURE_DIR, 'SOURCE.md');

export interface JsonResumeSchema {
  properties: Record<string, unknown>;
  definitions?: Record<string, unknown>;
  [key: string]: unknown;
}

/** El schema tal como se publicó (con su `$schema` draft-04). */
export function loadJsonResumeSchema(): JsonResumeSchema {
  return JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as JsonResumeSchema;
}

/** SHA-256 del archivo vendorizado, sobre sus bytes. */
export function jsonResumeSchemaSha256(): string {
  return createHash('sha256').update(readFileSync(SCHEMA_PATH)).digest('hex');
}

/** SHA-256 que declara `SOURCE.md`. */
export function declaredJsonResumeSchemaSha256(): string | null {
  const match = /SHA-256:\s*`([0-9a-f]{64})`/.exec(readFileSync(SOURCE_PATH, 'utf8'));
  return match ? match[1] : null;
}

export interface JsonResumeValidation {
  valid: boolean;
  errors: string[];
}

let compiled: ValidateFunction | undefined;

function validator(): ValidateFunction {
  if (compiled) return compiled;
  const { $schema: _dialect, ...schema } = loadJsonResumeSchema();
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv, ['uri', 'email', 'date']);
  compiled = ajv.compile(schema);
  return compiled;
}

/** Valida un documento y devuelve los errores legibles (`ruta mensaje`). */
export function validateJsonResume(document: unknown): JsonResumeValidation {
  const validate = validator();
  const valid = validate(document) === true;
  const errors = (validate.errors ?? []).map(
    (error) => `${error.instancePath || '/'} ${error.message ?? 'inválido'}`,
  );
  return { valid, errors };
}

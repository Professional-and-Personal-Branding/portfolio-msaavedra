/**
 * Lectura de la fuente del seed, sin Prisma: la comparten el seed, `seed:verify` y `cv:lint`
 * (que no abre la base ni importa `@prisma/client`).
 */
import * as fs from 'fs';
import * as path from 'path';
import { fail, ok, Result } from '../../src/shared/domain/result';

/** Fuente por defecto: la trayectoria real del owner, relativa a `backend/scripts/`. */
export const DEFAULT_SEED_FILE = path.resolve(__dirname, '../../../docs/cv-data.json');

/** Lee el archivo y lo parsea como JSON; no valida el formato. */
export function readSeedFile(filePath: string): Result<unknown, string> {
  if (!fs.existsSync(filePath)) return fail(`no existe el archivo ${filePath}`);
  try {
    return ok(JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown);
  } catch (e) {
    return fail(`${filePath} no es JSON válido: ${e instanceof Error ? e.message : String(e)}`);
  }
}

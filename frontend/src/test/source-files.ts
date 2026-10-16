import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Raíz del frontend (Vitest corre desde `frontend/`). */
export const FRONTEND_ROOT = process.cwd();

/** Todos los archivos de `src/` que no son tests, con su ruta relativa a `frontend/` y su texto. */
export function listProductionSources(): { path: string; text: string }[] {
  const found: { path: string; text: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
        found.push({
          path: full.slice(FRONTEND_ROOT.length + 1).replaceAll('\\', '/'),
          text: readFileSync(full, 'utf8'),
        });
      }
    }
  };
  walk(resolve(FRONTEND_ROOT, 'src'));
  return found;
}

export function readFrontendFile(relativePath: string): string {
  return readFileSync(resolve(FRONTEND_ROOT, relativePath), 'utf8');
}

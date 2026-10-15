import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Vitest corre desde la carpeta frontend. */
const SRC = join(process.cwd(), 'src');

/** Carpetas donde un `text-brand` es texto legible para una persona (spec `web-accessibility`). */
const DIRECTORIES = [
  'shared/components/portfolio',
  'features/navigation',
  'features/curated-view',
  'features/backoffice',
];

function tsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return /\.tsx$/.test(entry.name) && !/\.(test|spec)\.tsx$/.test(entry.name) ? [path] : [];
  });
}

/** `text-brand` o `text-brand-2` solos: sin `-ink`, `-foreground` ni opacidad (`/50`). */
const BARE_TEXT_BRAND = /text-brand(-2)?(?![-\w/])/;

describe('el acento como texto usa el derivado legible', () => {
  it('ningún texto usa `text-brand`: va `text-brand-ink` (solo los íconos aria-hidden conservan el acento)', () => {
    const offenders: string[] = [];
    for (const directory of DIRECTORIES) {
      for (const file of tsxFiles(join(SRC, directory))) {
        readFileSync(file, 'utf8')
          .split('\n')
          .forEach((line, index) => {
            if (BARE_TEXT_BRAND.test(line) && !line.includes('aria-hidden')) {
              offenders.push(`${relative(SRC, file)}:${index + 1}`);
            }
          });
      }
    }
    expect(offenders).toEqual([]);
  });
});

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Vitest corre desde la carpeta frontend. */
const SRC = join(process.cwd(), 'src');

/** Carpetas donde el texto lo lee una persona (spec `web-accessibility`). */
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

/** Un color de Tailwind con nombre como texto: no deriva del tema, no se garantiza el contraste. */
const NAMED_TEXT_COLOR =
  /text-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+/;
/**
 * El rojo de error como texto tiene que salir de `text-danger-ink` (derivado del tema): `text-destructive`
 * (con o sin variante) y las clases arbitrarias de texto que nombren `destructive`. `bg-`, `border-`
 * y `ring-destructive` no incumplen (no son texto).
 */
const DANGER_TEXT =
  /(?<![\w-])text-destructive(?![\w-])|(?<![\w-])text-\[[^\]]*destructive[^\]]*\]/;
/** Opacidad en la misma línea que el estado de visibilidad de una fila. */
const OPACITY_FOR_STATE = /opacity-\d+/;
const VISIBILITY_STATE = /data-visible|visible\s*\?|!?\w*\.?visible\b/;

/** Devuelve las líneas (`archivo:n`) que incumplen alguna regla; exportado al test para reusar. */
export function findOffenders(
  files: { name: string; text: string }[],
): { rule: 'color' | 'opacity' | 'danger'; at: string }[] {
  const offenders: { rule: 'color' | 'opacity' | 'danger'; at: string }[] = [];
  for (const { name, text } of files) {
    text.split('\n').forEach((line, index) => {
      const at = `${name}:${index + 1}`;
      if (NAMED_TEXT_COLOR.test(line)) offenders.push({ rule: 'color', at });
      if (DANGER_TEXT.test(line)) offenders.push({ rule: 'danger', at });
      if (OPACITY_FOR_STATE.test(line) && VISIBILITY_STATE.test(line)) {
        offenders.push({ rule: 'opacity', at });
      }
    });
  }
  return offenders;
}

describe('los estados no se expresan con colores literales ni con opacidad', () => {
  it('ninguna línea de la vista pública y del panel usa un color con nombre ni `text-destructive` como texto, ni opacidad por visibilidad', () => {
    const files = DIRECTORIES.flatMap((directory) =>
      tsxFiles(join(SRC, directory)).map((file) => ({
        name: relative(SRC, file),
        text: readFileSync(file, 'utf8'),
      })),
    );
    expect(findOffenders(files)).toEqual([]);
  });

  it('el detector atrapa `text-emerald-500` y `opacity-60` junto al estado visible', () => {
    const found = findOffenders([
      {
        name: 'prueba.tsx',
        text: [
          '<span className="text-emerald-500">Actual</span>',
          "<li data-visible={x} className={`${v ? '' : 'opacity-60'}`}>",
          '<span className="text-success-ink">Actual</span>',
        ].join('\n'),
      },
    ]);
    expect(found).toEqual([
      { rule: 'color', at: 'prueba.tsx:1' },
      { rule: 'opacity', at: 'prueba.tsx:2' },
    ]);
  });
});

describe('la regla `danger` obliga a `text-danger-ink` (fix-error-contrast-and-date-modified, D3)', () => {
  it('atrapa `text-destructive` (con variante) y `text-[color-mix(…destructive…)]`; no los botones ni el token', () => {
    const found = findOffenders([
      {
        name: 'prueba.tsx',
        text: [
          '<p role="alert" className="text-destructive">Error</p>',
          '<button className="hover:text-destructive">x</button>',
          '<p className="text-[color-mix(in_srgb,var(--color-destructive)_60%,var(--t-text))]">Error</p>',
          '<p role="alert" className="text-danger-ink">Error</p>',
          '<button className="bg-destructive text-white border-destructive">Borrar</button>',
        ].join('\n'),
      },
    ]);
    expect(found).toEqual([
      { rule: 'danger', at: 'prueba.tsx:1' },
      { rule: 'danger', at: 'prueba.tsx:2' },
      { rule: 'danger', at: 'prueba.tsx:3' },
    ]);
  });
});

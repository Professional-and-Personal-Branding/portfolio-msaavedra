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

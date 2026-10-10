import { describe, expect, it } from 'vitest';
import { makeCuratedProfile, makeExperience } from '@/test/fixtures/curated-profile';
import { buildPrintSheet, PRINT_LIMITS, type PrintBlock } from './print-sheet';

const ORIGIN = 'https://portfolio.example.com';

function experiences(n: number) {
  return Array.from({ length: n }, (_, i) =>
    makeExperience({
      id: `exp-${i}`,
      company: `Empresa ${i}`,
      role: `Rol ${i}`,
      startDate: `${2024 - i}-01-01`,
      endDate: i === 0 ? null : `${2024 - i}-12-31`,
      current: i === 0,
      highlights: Array.from({ length: 12 }, (_, h) => `Logro ${i}.${h}`),
      technologies: Array.from({ length: 12 }, (_, t) => `Tech${t}`),
    }),
  );
}

function block<K extends PrintBlock['kind']>(
  blocks: PrintBlock[],
  kind: K,
): Extract<PrintBlock, { kind: K }> {
  const found = blocks.find((b) => b.kind === kind);
  if (!found) throw new Error(`falta el bloque ${kind}`);
  return found as Extract<PrintBlock, { kind: K }>;
}

describe('buildPrintSheet — orden y secciones', () => {
  it('sigue el orden de sections, con stats, contact y presence fuera de los bloques', () => {
    const sheet = buildPrintSheet(makeCuratedProfile(), 'es', ORIGIN);
    expect(sheet.blocks.map((b) => b.section)).toEqual([
      'hero',
      'experience',
      'skills',
      'projects',
      'education',
      'certifications',
    ]);
  });

  it('respeta un orden personalizado y no reordena', () => {
    const data = makeCuratedProfile({ sections: ['hero', 'skills', 'experience', 'education'] });
    const sheet = buildPrintSheet(data, 'es', ORIGIN);
    expect(sheet.blocks.map((b) => b.section)).toEqual([
      'hero',
      'skills',
      'experience',
      'education',
    ]);
  });

  it('una sección ausente de sections no imprime su bloque', () => {
    const data = makeCuratedProfile({ sections: ['hero', 'experience'] });
    const kinds = buildPrintSheet(data, 'es', ORIGIN).blocks.map((b) => b.kind);
    expect(kinds).not.toContain('certifications');
    expect(kinds).not.toContain('skills');
  });

  it('un bloque sin datos no se imprime', () => {
    const data = makeCuratedProfile({ certifications: [] });
    const kinds = buildPrintSheet(data, 'es', ORIGIN).blocks.map((b) => b.kind);
    expect(kinds).not.toContain('certifications');
  });

  it('ignora ids que no conoce en lugar de romper', () => {
    const data = makeCuratedProfile({ sections: ['hero', 'inventada' as never, 'skills'] });
    expect(buildPrintSheet(data, 'es', ORIGIN).blocks.map((b) => b.section)).toEqual([
      'hero',
      'skills',
    ]);
  });
});

describe('buildPrintSheet — encabezado', () => {
  it('lleva nombre, titular, email, ubicación y LinkedIn', () => {
    const { header } = buildPrintSheet(makeCuratedProfile(), 'es', ORIGIN);
    expect(header.fullName).toBe('Ada Ejemplo');
    expect(header.headline).toBe('Ingeniero de software');
    const texts = header.contact.map((l) => l.text);
    expect(texts).toContain('ada@example.com');
    expect(texts).toContain('La Paz, Bolivia');
    expect(texts).toContain('linkedin.com/in/ada-ejemplo');
    expect(header.contact.find((l) => l.text === 'ada@example.com')?.href).toBe(
      'mailto:ada@example.com',
    );
  });

  it('con contact en sections suma teléfono, idiomas y disponibilidad', () => {
    const { header } = buildPrintSheet(makeCuratedProfile(), 'es', ORIGIN);
    expect(header.contact.map((l) => l.text)).toContain('+591 70000000');
    expect(header.details.join(' | ')).toContain('Español · Nativo');
    expect(header.details.join(' | ')).toContain('Remoto');
    expect(header.details.join(' | ')).toContain('Freelance');
    expect(header.details.join(' | ')).toContain('Inmediata');
  });

  it('sin contact en sections no suma teléfono ni idiomas ni disponibilidad, pero conserva email y ubicación', () => {
    const data = makeCuratedProfile({ sections: ['hero', 'experience'] });
    const { header } = buildPrintSheet(data, 'es', ORIGIN);
    const texts = header.contact.map((l) => l.text);
    expect(texts).not.toContain('+591 70000000');
    expect(texts).toContain('ada@example.com');
    expect(texts).toContain('La Paz, Bolivia');
    expect(header.details).toEqual([]);
  });

  it('con presence suma hasta 2 enlaces featured además de LinkedIn', () => {
    const links = ['github', 'x', 'medium', 'youtube'].map((platform, i) => ({
      id: `l-${i}`,
      platform,
      handle: platform,
      url: `https://${platform}.com/ada`,
      label: platform,
      description: '',
      stats: null,
      featured: true,
      order: i + 1,
    }));
    const linkedin = makeCuratedProfile().socialLinks[1]!;
    const data = makeCuratedProfile({ socialLinks: [...links, linkedin] });
    const texts = buildPrintSheet(data, 'es', ORIGIN).header.contact.map((l) => l.text);
    expect(texts).toContain('github.com/ada');
    expect(texts).toContain('x.com/ada');
    expect(texts).not.toContain('medium.com/ada');
    expect(texts.filter((t) => t.startsWith('linkedin.com'))).toHaveLength(1);
  });

  it('sin presence en sections no suma enlaces featured', () => {
    const data = makeCuratedProfile({ sections: ['hero', 'experience'] });
    const texts = buildPrintSheet(data, 'es', ORIGIN).header.contact.map((l) => l.text);
    expect(texts.some((t) => t.startsWith('github.com'))).toBe(false);
  });

  it('en all no imprime la description; en otro perfil sí', () => {
    expect(buildPrintSheet(makeCuratedProfile(), 'es', ORIGIN).header.description).toBeNull();
    const data = makeCuratedProfile({ slug: 'tech-lead', description: 'Para equipos grandes.' });
    expect(buildPrintSheet(data, 'es', ORIGIN).header.description).toBe('Para equipos grandes.');
  });

  it('usa el titular del perfil curado y, si falta, el del perfil base', () => {
    expect(
      buildPrintSheet(makeCuratedProfile({ headline: 'Tech Lead .NET' }), 'es', ORIGIN).header
        .headline,
    ).toBe('Tech Lead .NET');
    expect(
      buildPrintSheet(makeCuratedProfile({ headline: '' }), 'es', ORIGIN).header.headline,
    ).toBe('Ingeniera de software');
  });
});

describe('buildPrintSheet — límites', () => {
  it('perfil con 13 experiencias: 3 en detalle, 3 en una línea y 7 omitidas', () => {
    const data = makeCuratedProfile({ experiences: experiences(13) });
    const exp = block(buildPrintSheet(data, 'es', ORIGIN).blocks, 'experience');
    expect(exp.detailed).toHaveLength(3);
    expect(exp.lines).toHaveLength(3);
    expect(exp.omitted).toBe(7);
    expect(exp.omittedLabel).toBe('y 7 experiencias más');
    // El orden es el de la API: las primeras son las más recientes.
    expect(exp.detailed.map((e) => e.role)).toEqual(['Rol 0', 'Rol 1', 'Rol 2']);
    expect(exp.lines[0]).toContain('Rol 3');
    expect(exp.lines[0]).toContain('Empresa 3');
  });

  it('logros recortados: de 12 se muestran los 2 primeros', () => {
    const data = makeCuratedProfile({ experiences: experiences(1) });
    const exp = block(buildPrintSheet(data, 'es', ORIGIN).blocks, 'experience');
    expect(exp.detailed[0]?.achievements).toEqual(['Logro 0.0', 'Logro 0.1']);
  });

  it('tecnologías: 8 y un resto contado', () => {
    const data = makeCuratedProfile({ experiences: experiences(1) });
    const first = block(buildPrintSheet(data, 'es', ORIGIN).blocks, 'experience').detailed[0]!;
    expect(first.technologies).toHaveLength(PRINT_LIMITS.technologiesPerExperience);
    expect(first.technologiesMore).toBe(4);
  });

  it('con 6 experiencias exactas no hay línea de omitidos', () => {
    const data = makeCuratedProfile({ experiences: experiences(6) });
    const exp = block(buildPrintSheet(data, 'es', ORIGIN).blocks, 'experience');
    expect(exp.omitted).toBe(0);
    expect(exp.omittedLabel).toBeNull();
  });

  it('skills: 3 categorías con 10 skills como máximo y resto contado', () => {
    const skillCategories = Array.from({ length: 9 }, (_, i) => ({
      name: `Cat ${i}`,
      skills: Array.from({ length: 14 }, (_, s) => `S${i}-${s}`),
    }));
    const skills = block(
      buildPrintSheet(makeCuratedProfile({ skillCategories }), 'es', ORIGIN).blocks,
      'skills',
    );
    expect(skills.categories).toHaveLength(3);
    expect(skills.categories[0]?.skills).toHaveLength(10);
    expect(skills.categories[0]?.more).toBe(4);
    expect(skills.omitted).toBe(6);
    expect(skills.omittedLabel).toBe('y 6 categorías más');
  });

  it('proyectos 2, formación 3 y certificaciones 4, con sus cuentas', () => {
    const projectBase = makeCuratedProfile().projects[0]!;
    const eduBase = makeCuratedProfile().education[0]!;
    const certBase = makeCuratedProfile().certifications[0]!;
    const data = makeCuratedProfile({
      projects: Array.from({ length: 4 }, (_, i) => ({
        ...projectBase,
        id: `p${i}`,
        name: `P${i}`,
      })),
      education: Array.from({ length: 6 }, (_, i) => ({ ...eduBase, id: `e${i}` })),
      certifications: Array.from({ length: 8 }, (_, i) => ({
        ...certBase,
        id: `c${i}`,
        name: `C${i}`,
      })),
    });
    const { blocks } = buildPrintSheet(data, 'es', ORIGIN);
    expect(block(blocks, 'projects').items).toHaveLength(2);
    expect(block(blocks, 'projects').omitted).toBe(2);
    expect(block(blocks, 'education').items).toHaveLength(3);
    expect(block(blocks, 'education').omitted).toBe(3);
    expect(block(blocks, 'certifications').items).toHaveLength(4);
    expect(block(blocks, 'certifications').omitted).toBe(4);
    expect(block(blocks, 'certifications').omittedLabel).toBe('y 4 certificaciones más');
  });

  it('formación en curso lleva la marca de en curso', () => {
    const eduBase = makeCuratedProfile().education[0]!;
    const data = makeCuratedProfile({
      education: [{ ...eduBase, endDate: null, inProgress: true }],
    });
    const edu = block(buildPrintSheet(data, 'es', ORIGIN).blocks, 'education');
    expect(edu.items[0]?.inProgress).toBe(true);
    expect(edu.items[0]?.period).toContain('En curso');
  });

  it('los omitidos salen en el idioma de la vista', () => {
    const data = makeCuratedProfile({ experiences: experiences(13) });
    const exp = block(buildPrintSheet(data, 'en', ORIGIN).blocks, 'experience');
    expect(exp.omittedLabel).toBe('and 7 more roles');
    const one = block(
      buildPrintSheet(makeCuratedProfile({ experiences: experiences(7) }), 'en', ORIGIN).blocks,
      'experience',
    );
    expect(one.omittedLabel).toBe('and 1 more role');
  });

  it('el resumen del hero va como bloque Perfil', () => {
    const summary = block(buildPrintSheet(makeCuratedProfile(), 'es', ORIGIN).blocks, 'summary');
    expect(summary.text).toBe('Más de una década construyendo sistemas.');
  });
});

describe('buildPrintSheet — URL de la versión completa', () => {
  it('es la canónica del perfil, sin parámetros en español', () => {
    const data = makeCuratedProfile({ slug: 'dotnet-backend', visibility: 'PROTECTED' });
    expect(buildPrintSheet(data, 'es', ORIGIN).fullUrl).toBe(`${ORIGIN}/dotnet-backend`);
  });

  it('la home es la raíz', () => {
    expect(buildPrintSheet(makeCuratedProfile(), 'es', ORIGIN).fullUrl).toBe(`${ORIGIN}/`);
  });

  it('en inglés suma ?lang=en y nada más', () => {
    const data = makeCuratedProfile({ slug: 'fullstack-nest-react' });
    expect(buildPrintSheet(data, 'en', ORIGIN).fullUrl).toBe(
      `${ORIGIN}/fullstack-nest-react?lang=en`,
    );
  });

  it('nunca incluye token, theme ni layout', () => {
    // El origen no trae query: aunque la barra de direcciones los tenga, la hoja no los lee.
    const data = makeCuratedProfile({ slug: 'dotnet-backend' });
    for (const locale of ['es', 'en'] as const) {
      const { fullUrl } = buildPrintSheet(data, locale, ORIGIN);
      expect(fullUrl).not.toMatch(/token|theme|layout/);
    }
  });
});

describe('buildPrintSheet — perfil sin datos base', () => {
  it('sin profile usa el título del perfil curado como nombre', () => {
    const sheet = buildPrintSheet(makeCuratedProfile({ profile: null }), 'es', ORIGIN);
    expect(sheet.header.fullName).toBe('Perfil completo');
    expect(sheet.header.contact.map((l) => l.text)).not.toContain('ada@example.com');
  });
});

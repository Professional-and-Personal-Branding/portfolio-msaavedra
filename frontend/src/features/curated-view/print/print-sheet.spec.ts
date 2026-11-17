import { describe, expect, it } from 'vitest';
import { makeCuratedProfile, makeExperience } from '@/test/fixtures/curated-profile';
import type { CuratedProfile } from '@/shared/types/portfolio';
import {
  buildPrintSheet,
  estimatePrintLines,
  PRINT_CAPACITY_LINES,
  PRINT_LIMITS,
  type PrintBlock,
} from './print-sheet';

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
      'repositories',
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

  describe('credenciales de las certificaciones (add-certification-verification, D7)', () => {
    const NOW = new Date(2026, 9, 29);
    const base = makeCuratedProfile().certifications[0]!;
    const withCredential = {
      ...base,
      id: 'c1',
      name: 'Arquitecto Cloud',
      issuer: 'Escuela Demo',
      year: '2021',
      verificationUrl: 'https://example.org/credenciales/arquitecto',
      credentialId: 'EJ-1',
      expiresAt: '2029-06',
    };
    const expiredNoLink = {
      ...base,
      id: 'c2',
      name: 'Liderazgo',
      issuer: 'Escuela Demo',
      year: null,
      verificationUrl: null,
      credentialId: null,
      expiresAt: '2025-12',
    };
    const items = (locale: 'es' | 'en') =>
      block(
        buildPrintSheet(
          makeCuratedProfile({ certifications: [withCredential, expiredNoLink] }),
          locale,
          ORIGIN,
          NOW,
        ).blocks,
        'certifications',
      ).items;

    it('la credencial es un PrintLink y la URL no entra en el texto', () => {
      const [first] = items('es');
      expect(first?.credential).toEqual({
        text: 'Ver credencial',
        href: 'https://example.org/credenciales/arquitecto',
      });
      expect(first?.text).toBe('Arquitecto Cloud (Escuela Demo, 2021)');
      expect(first?.text).not.toContain('example.org');
      expect(first?.expired).toBe(false);
    });

    it('una vencida suma «vencida» («expired») al paréntesis y no lleva enlace', () => {
      expect(items('es')[1]).toEqual({
        text: 'Liderazgo (Escuela Demo, vencida)',
        credential: null,
        expired: true,
      });
      expect(items('en')[1]?.text).toBe('Liderazgo (Escuela Demo, expired)');
      expect(items('en')[0]?.credential?.text).toBe('View credential');
    });

    it('sin credenciales el texto es el de siempre y los límites no cambian', () => {
      const plain = block(
        buildPrintSheet(makeCuratedProfile(), 'es', ORIGIN, NOW).blocks,
        'certifications',
      );
      expect(plain.items.map((i) => i.text)).toEqual([
        'AWS Solutions Architect (AWS, 2023)',
        'Scrum Master (Scrum.org)',
      ]);
      expect(plain.items.every((i) => i.credential === null && !i.expired)).toBe(true);
      expect(PRINT_LIMITS.certifications).toBe(4);
    });
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

// Change add-featured-repositories (D9): una línea compacta, solo si entra.
describe('buildPrintSheet — repositorios (D9)', () => {
  const repo = (i: number, overrides: Partial<CuratedProfile['repositories'][number]> = {}) => ({
    id: `r${i}`,
    name: `repo-${i}`,
    url: `https://github.com/octo-org/repo-${i}`,
    language: 'Java',
    description: `Descripción ${i}`,
    technologies: ['Java'],
    tags: [],
    order: i,
    evidence: null,
    ...overrides,
  });
  const repos = (n: number) => Array.from({ length: n }, (_, i) => repo(i));
  const sections = ['hero', 'experience', 'repositories'];
  const repositoriesBlock = (data: CuratedProfile) =>
    buildPrintSheet(data, 'es', ORIGIN).blocks.find((b) => b.kind === 'repositories');

  /** Un perfil cuya hoja SIN repositorios estima exactamente `target` líneas (1 línea por cada 110 caracteres). */
  function profileEstimating(target: number, repositories = repos(2)) {
    const base = makeCuratedProfile({
      sections,
      experiences: [makeExperience({ highlights: ['x'], technologies: [] })],
      repositories: [],
    });
    const baseline = estimatePrintLines(buildPrintSheet(base, 'es', ORIGIN).blocks);
    const extra = target - baseline;
    if (extra < 0 || !Number.isInteger(extra)) throw new Error(`no se puede estimar ${target}`);
    return makeCuratedProfile({
      sections,
      experiences: [
        makeExperience({ highlights: ['x'.repeat(110 * (1 + extra))], technologies: [] }),
      ],
      repositories,
    });
  }

  it('entra: una línea con los nombres, cada uno con su href, en la posición de sections', () => {
    const sheet = buildPrintSheet(makeCuratedProfile(), 'es', ORIGIN);
    const found = block(sheet.blocks, 'repositories');
    expect(found.label).toBe('Repositorios');
    expect(found.items).toEqual([
      { text: 'reservas-api', href: 'https://github.com/ejemplo/reservas-api' },
      { text: 'metricas-dashboard', href: 'https://github.com/ejemplo/metricas-dashboard' },
    ]);
    expect(found.omitted).toBe(0);
    expect(found.omittedLabel).toBeNull();
    // El texto impreso no incluye la URL: solo viaja como href.
    expect(JSON.stringify(found.items.map((i) => i.text))).not.toContain('github.com');
  });

  it('la capacidad es un entero (los pesos del estimador llegan a medias líneas)', () => {
    expect(Number.isInteger(PRINT_CAPACITY_LINES)).toBe(true);
  });

  it('un estimado de capacidad − 2 deja lugar: entra', () => {
    expect(repositoriesBlock(profileEstimating(PRINT_CAPACITY_LINES - 2))).toBeDefined();
  });

  it('un estimado de capacidad − 1 no deja lugar: no entra y no hay línea de omitidos', () => {
    const data = profileEstimating(PRINT_CAPACITY_LINES - 1);
    const sheet = buildPrintSheet(data, 'es', ORIGIN);
    expect(sheet.blocks.find((b) => b.kind === 'repositories')).toBeUndefined();
    expect(sheet.blocks.every((b) => b.omittedLabel === null)).toBe(true);
    expect(JSON.stringify(sheet)).not.toContain('print.omitted.repositories');
  });

  it('el estimado agrega 1,5 líneas al incluir la línea de repositorios', () => {
    const data = profileEstimating(PRINT_CAPACITY_LINES - 2);
    const sheet = buildPrintSheet(data, 'es', ORIGIN);
    const without = sheet.blocks.filter((b) => b.kind !== 'repositories');
    expect(estimatePrintLines(sheet.blocks) - estimatePrintLines(without)).toBe(1.5);
  });

  it('con 5 repositorios muestra los 3 primeros y «y 2 más»', () => {
    const found = block(
      buildPrintSheet(makeCuratedProfile({ repositories: repos(5) }), 'es', ORIGIN).blocks,
      'repositories',
    );
    expect(found.items.map((i) => i.text)).toEqual(['repo-0', 'repo-1', 'repo-2']);
    expect(found.items).toHaveLength(PRINT_LIMITS.repositories);
    expect(found.omitted).toBe(2);
    expect(found.omittedLabel).toBe('y 2 más');
  });

  it('con 4 repositorios cierra con «and 1 more» en inglés', () => {
    const found = block(
      buildPrintSheet(makeCuratedProfile({ repositories: repos(4) }), 'en', ORIGIN).blocks,
      'repositories',
    );
    expect(found.label).toBe('Repositories');
    expect(found.omittedLabel).toBe('and 1 more');
  });

  it('un nombre de 45 caracteres se recorta con «…» y conserva el href completo', () => {
    const long = 'n'.repeat(45);
    const found = block(
      buildPrintSheet(
        makeCuratedProfile({ repositories: [repo(0, { name: long }), repo(1)] }),
        'es',
        ORIGIN,
      ).blocks,
      'repositories',
    );
    expect(found.items[0]!.text).toHaveLength(40);
    expect(found.items[0]!.text.endsWith('…')).toBe(true);
    expect(found.items[0]!.href).toBe('https://github.com/octo-org/repo-0');
    expect(found.items[1]!.text).toBe('repo-1');
  });

  it('un nombre de 40 caracteres no se recorta', () => {
    const exact = 'n'.repeat(40);
    const found = block(
      buildPrintSheet(
        makeCuratedProfile({ repositories: [repo(0, { name: exact }), repo(1)] }),
        'es',
        ORIGIN,
      ).blocks,
      'repositories',
    );
    expect(found.items[0]!.text).toBe(exact);
  });

  it('sin repositories en sections no hay bloque aunque haya datos', () => {
    const data = makeCuratedProfile({ sections: ['hero', 'experience'], repositories: repos(3) });
    expect(repositoriesBlock(data)).toBeUndefined();
  });

  it('con repositories en sections pero sin datos no hay bloque', () => {
    expect(repositoriesBlock(makeCuratedProfile({ repositories: [] }))).toBeUndefined();
  });

  it('respeta la posición de sections: antes de la experiencia si así viene', () => {
    const data = makeCuratedProfile({ sections: ['hero', 'repositories', 'experience'] });
    const kinds = buildPrintSheet(data, 'es', ORIGIN).blocks.map((b) => b.section);
    expect(kinds).toEqual(['hero', 'repositories', 'experience']);
  });
});

describe('estimatePrintLines (D9)', () => {
  it('una hoja vacía pesa el encabezado y la URL de cierre', () => {
    expect(estimatePrintLines([])).toBe(6);
  });

  it('suma el título de cada bloque y las líneas de texto por 110 caracteres', () => {
    const summary = (text: string): PrintBlock => ({
      kind: 'summary',
      section: 'hero',
      label: 'Perfil',
      text,
      omitted: 0,
      omittedLabel: null,
    });
    expect(estimatePrintLines([summary('x'.repeat(110))])).toBe(6 + 1.5 + 1);
    expect(estimatePrintLines([summary('x'.repeat(111))])).toBe(6 + 1.5 + 2);
    // El resumen cuenta como máximo 4 líneas.
    expect(estimatePrintLines([summary('x'.repeat(1000))])).toBe(6 + 1.5 + 4);
  });

  it('cuenta una línea por cada aviso de omitidos', () => {
    const data = makeCuratedProfile({
      sections: ['experience'],
      experiences: experiences(13),
    });
    const blocks = buildPrintSheet(data, 'es', ORIGIN).blocks;
    const withLabel = estimatePrintLines(blocks);
    const withoutLabel = estimatePrintLines(blocks.map((b) => ({ ...b, omittedLabel: null })));
    expect(withLabel - withoutLabel).toBe(1);
  });
});

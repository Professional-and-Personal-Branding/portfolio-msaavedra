import * as fs from 'fs';
import * as path from 'path';
import { SECTION_IDS } from '../src/modules/curated-profile/domain/services/resolve-sections';
import { selectByTags } from '../src/modules/curated-profile/domain/services/select-by-tags';
import { parseSeedSource, SeedSource } from '../scripts/lib/seed-source';

/**
 * Cobertura del archivo de ejemplo (change `add-learning-guide-and-example-data`, spec
 * `example-seed-data`): cada entidad, cada sección y cada mecanismo del perfil curado aparece en
 * al menos un dato, y el archivo no se confunde con el CV real. Sin base de datos.
 */
const docs = path.resolve(__dirname, '../../docs');
const read = (file: string): string => fs.readFileSync(path.join(docs, file), 'utf-8');
const exampleRaw = read('examples/cv-data.example.json');
const parsed = parseSeedSource(JSON.parse(exampleRaw));
if (!parsed.ok) throw new Error(`El ejemplo no cumple el formato: ${JSON.stringify(parsed.error)}`);
const ex: SeedSource = parsed.value;
const real = JSON.parse(read('cv-data.json')) as { profile: Record<string, string> };

const tpl = (slug: string) => {
  const t = ex.profileTemplates.find((x) => x.slug === slug);
  if (!t) throw new Error(`falta la plantilla ${slug}`);
  return t;
};
const isReserved = (url: string): boolean =>
  url.startsWith('https://') && /(^|\.)example\.(com|org|net)$/.test(new URL(url).hostname);

describe('el ejemplo es ficticio', () => {
  it('no contiene el nombre, el email ni el teléfono del CV real', () => {
    for (const key of ['fullName', 'email', 'phone']) {
      expect(exampleRaw).not.toContain(real.profile[key]);
    }
    expect(ex.profile.email.endsWith('@example.com')).toBe(true);
    expect(ex.profile.phone).toMatch(/^\+1 555 01\d\d$/);
  });

  it('todas las URL usan https y un dominio reservado (RFC 2606)', () => {
    const urls = [
      ...ex.projects.flatMap((p) => (p.url ? [p.url] : [])),
      ...(ex.profile.socialLinks ?? []).map((l) => l.url),
      ...ex.certifications.flatMap((c) => (c.verificationUrl ? [c.verificationUrl] : [])),
    ];
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(isReserved(url)).toBe(true);
  });

  it('muestra una credencial vigente con enlace e ID y una vencida sin enlace (D9)', () => {
    const valid = ex.certifications.filter((c) => c.verificationUrl);
    expect(valid).toHaveLength(1);
    expect(valid[0]).toMatchObject({
      verificationUrl: 'https://example.org/credenciales/arquitecto-nube-2023',
      credentialId: 'EJ-2023-0042',
      expiresAt: '2029-06',
    });
    const expired = ex.certifications.filter((c) => c.expiresAt === '2025-12');
    expect(expired).toHaveLength(1);
    expect(expired[0].verificationUrl ?? null).toBeNull();
  });

  it('solo los referrer de las visitas imitan orígenes reales', () => {
    const rest = JSON.stringify({ ...ex, exampleViews: undefined });
    const hosts = [...rest.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((m) => m[1].toLowerCase());
    for (const host of hosts) expect(host).toMatch(/(^|\.)example\.(com|org|net)$/);
  });
});

describe('cobertura de entidades y secciones', () => {
  it('cada tabla de contenido tiene filas, salvo FeaturedRepository', () => {
    expect(ex.profile.languages).toHaveLength(3);
    expect(ex.experiences).toHaveLength(6);
    expect(ex.skillCategories).toHaveLength(4);
    expect(ex.skillCategories.reduce((n, c) => n + c.skills.length, 0)).toBe(16);
    expect(ex.education).toHaveLength(3);
    expect(ex.certifications).toHaveLength(3);
    expect(ex.projects).toHaveLength(3);
    expect(ex.profile.socialLinks).toHaveLength(4);
    expect((ex.profile.featuredRepositories ?? []).filter((r) => r.visible)).toEqual([]);
  });

  it('incluye los casos de borde de cada entidad', () => {
    expect(ex.experiences.some((e) => e.current && e.endDate === null)).toBe(true);
    expect(ex.education.some((e) => e.inProgress)).toBe(true);
    expect(ex.education.some((e) => /^\d{4}$/.test(e.startDate))).toBe(true);
    expect(ex.certifications.some((c) => c.year === null)).toBe(true);
    expect(ex.projects.some((p) => p.url !== null)).toBe(true);
    expect(ex.projects.some((p) => p.url === null)).toBe(true);
    expect((ex.profile.socialLinks ?? []).some((l) => l.stats !== undefined && l.featured)).toBe(
      true,
    );
    expect((ex.profile.socialLinks ?? []).some((l) => !l.featured && l.visible)).toBe(true);
  });

  it('hay un ítem oculto en experiencias, formación, certificaciones, proyectos y enlaces', () => {
    expect(ex.experiences.some((e) => e.visible === false)).toBe(true);
    expect(ex.education.some((e) => e.visible === false)).toBe(true);
    expect(ex.certifications.some((c) => c.visible === false)).toBe(true);
    expect(ex.projects.some((p) => p.visible === false)).toBe(true);
    expect((ex.profile.socialLinks ?? []).some((l) => !l.visible)).toBe(true);
  });

  it('los idiomas cubren nativo, MCER con detalle e intermedio', () => {
    const levels = ex.profile.languages.map((l) => l.level.en);
    expect(levels).toContain('Native');
    expect(levels).toContain('Intermediate');
    expect(levels.some((l) => /\(C\d\)/.test(l ?? ''))).toBe(true);
  });

  it('una categoría de skills usa tags propios y otra skills { name, tags }', () => {
    expect(ex.skillCategories.some((c) => c.tags !== undefined)).toBe(true);
    expect(ex.skillCategories.some((c) => c.skills.some((s) => typeof s !== 'string'))).toBe(true);
  });
});

describe('cobertura de los mecanismos del perfil curado', () => {
  const all = ex.profileTemplates;

  it('ejerce cada mecanismo en al menos una plantilla', () => {
    expect(all.some((t) => t.filterTags.length > 0)).toBe(true);
    expect(all.some((t) => (t.includeRefs ?? []).length > 0)).toBe(true);
    expect(all.some((t) => (t.excludeRefs ?? []).length > 0)).toBe(true);
    expect(all.some((t) => (t.sectionsHidden ?? []).length > 0)).toBe(true);
    expect(all.some((t) => t.layout === 'sidebar')).toBe(true);
    expect(all.some((t) => t.theme !== undefined && t.theme !== 'modern-dark')).toBe(true);
    expect(all.some((t) => t.listed === false)).toBe(true);
    expect(all.some((t) => t.archived === true)).toBe(true);
    expect(all.some((t) => (t.slugAliases ?? []).length > 0)).toBe(true);
    expect(new Set(all.map((t) => t.visibility ?? 'PUBLIC'))).toEqual(
      new Set(['PUBLIC', 'PROTECTED', 'PRIVATE']),
    );
  });

  it('hay un sectionsOrder con las 9 secciones y distinto del canónico', () => {
    const order = tpl('ejemplo-secciones').sectionsOrder ?? [];
    expect([...order].sort()).toEqual([...SECTION_IDS].sort());
    expect(order).not.toEqual([...SECTION_IDS]);
  });

  it('el acento de ejemplo-backend es oscuro (#1A365D)', () => {
    const accent = (tpl('ejemplo-backend').themeOverrides as { colors: { accent: string } }).colors
      .accent;
    expect(accent).toBe('#1A365D');
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(accent.slice(i, i + 2), 16) / 255);
    expect(0.2126 * r + 0.7152 * g + 0.0722 * b).toBeLessThan(0.25);
  });

  it('las plantillas tienen roleType y techFocus', () => {
    for (const t of all) {
      expect(t.roleType).toBeDefined();
      expect(t.techFocus).toBeTruthy();
    }
  });

  it('el PROTECTED trae el token documentado y el PRIVATE no trae description.en', () => {
    expect(tpl('ejemplo-protegido').accessToken).toBe('ejemplo-token-2026');
    expect(tpl('ejemplo-borrador').description.en).toBeUndefined();
  });

  it('el override sobre un ítem oculto no lo trae, y los demás sí', () => {
    const t = tpl('ejemplo-overrides');
    const visible = ex.experiences.filter((e) => e.visible !== false);
    const pick = (refs: string[] | undefined, kind: string) =>
      (refs ?? []).filter((r) => r.startsWith(`${kind}:`)).map((r) => r.slice(kind.length + 1));
    const selected = selectByTags(visible, {
      filterTags: t.filterTags,
      includeIds: pick(t.includeRefs, 'experience'),
      excludeIds: pick(t.excludeRefs, 'experience'),
    }).map((e) => e.id);
    expect(selected).toContain('brujula'); // forzada, sin tags comunes
    expect(selected).not.toContain('terracota'); // oculta: el composer la ignora
    expect(selected).not.toContain('atlas'); // excluida aunque comparte tags
    expect(selected).toContain('cobalto');
  });

  it('el perfil archivado conserva visitas sintéticas', () => {
    const views = (ex.exampleViews ?? []).find((v) => v.slug === 'ejemplo-archivado');
    expect(views?.count).toBeGreaterThan(0);
    expect((ex.exampleViews ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it('las visitas incluyen origen directo, buscador, LinkedIn y un dominio example.com', () => {
    const referrers = new Set((ex.exampleViews ?? []).flatMap((v) => v.referrers));
    expect(referrers.has(null)).toBe(true);
    expect([...referrers].some((r) => r?.includes('google'))).toBe(true);
    expect([...referrers].some((r) => r?.includes('linkedin'))).toBe(true);
    expect([...referrers].some((r) => r?.includes('example.com'))).toBe(true);
  });

  it('falla si se quita un mecanismo: sin alias el chequeo de cobertura lo detecta', () => {
    const without = ex.profileTemplates.map((t) => ({ ...t, slugAliases: [] }));
    expect(without.some((t) => (t.slugAliases ?? []).length > 0)).toBe(false);
  });
});

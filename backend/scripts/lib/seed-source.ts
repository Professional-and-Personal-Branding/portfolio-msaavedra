/**
 * Formato de la fuente del seed (`docs/cv-data.json` y `docs/examples/cv-data.example.json`):
 * tipos, validación completa, resolución de referencias y visitas sintéticas. Módulo puro,
 * sin base ni sistema de archivos, para poder probarlo sin infraestructura.
 *
 * Los campos opcionales del formato extendido (change `add-learning-guide-and-example-data`,
 * D3) son compatibles hacia atrás: ausentes, el seed hace exactamente lo de siempre.
 */
import { fail, ok, Result } from '../../src/shared/domain/result';
import { SECTION_IDS } from '../../src/modules/curated-profile/domain/services/resolve-sections';
import {
  validateCertification,
  YEAR_REGEX,
} from '../../src/modules/education/domain/services/validate-certification';
import { THEME_PRESETS } from './seed-defaults';

// ── Tipos de la fuente ───────────────────────────────────────────
// `type` y no `interface`: así encajan en los campos `Json` de Prisma (índice implícito).
export type LocalizedText = { es: string; en?: string };
export type LocalizedList = { es: string[]; en?: string[] };

export type SeedVisibility = 'PUBLIC' | 'PROTECTED' | 'PRIVATE';
export type SeedLayout = 'classic' | 'sidebar';

export interface SeedSocialLink {
  platform: string;
  handle: string;
  url: string;
  label: LocalizedText;
  description?: LocalizedText;
  stats?: Record<string, unknown>;
  featured: boolean;
  visible: boolean;
}

export interface SeedFeaturedRepository {
  name: string;
  url: string;
  language?: string;
  description: LocalizedText;
  tags: string[];
  technologies?: string[];
  stars?: number;
  visible: boolean;
}

export interface SeedLanguage {
  name: string;
  nameI18n: LocalizedText;
  level: LocalizedText;
  detail: LocalizedText;
}

export interface SeedExperience {
  id: string;
  company: string;
  role: LocalizedText;
  startDate: string;
  endDate: string | null;
  current: boolean;
  location: string;
  sector: string[];
  summary: LocalizedText;
  highlights: LocalizedList;
  technologies: string[];
  tags: string[];
  visible?: boolean;
}

export interface SeedSkill {
  name: string;
  tags?: string[];
}

export interface SeedSkillCategory {
  name: LocalizedText;
  tags?: string[];
  skills: (string | SeedSkill)[];
}

export interface SeedEducation {
  degree: LocalizedText;
  institution: string;
  startDate: string;
  endDate: string | null;
  inProgress: boolean;
  visible?: boolean;
}

export interface SeedCertification {
  name: LocalizedText;
  issuer: string;
  year: string | null;
  /** URL https de la página pública de la credencial; ausente → null. */
  verificationUrl?: string | null;
  credentialId?: string | null;
  /** `YYYY-MM` o `YYYY`; ausente → null. */
  expiresAt?: string | null;
  visible?: boolean;
}

export interface SeedProject {
  id: string;
  name: string;
  role: LocalizedText;
  period: string;
  summary: LocalizedText;
  technologies: string[];
  tags: string[];
  url: string | null;
  visible?: boolean;
}

export interface SeedTemplate {
  slug: string;
  title: LocalizedText;
  description: LocalizedText;
  headline: LocalizedText;
  roleType?: LocalizedText;
  techFocus?: string;
  filterTags: string[];
  /** Override parcial del tema; el acento vive en `colors.accent` (retire-accent-color, D11). */
  themeOverrides?: Record<string, unknown>;
  listed?: boolean;
  theme?: string;
  layout?: SeedLayout;
  visibility?: SeedVisibility;
  accessToken?: string;
  sectionsOrder?: string[];
  sectionsHidden?: string[];
  includeRefs?: string[];
  excludeRefs?: string[];
  archived?: boolean;
  slugAliases?: string[];
}

export interface SeedExampleViews {
  slug: string;
  count: number;
  daysBack: number;
  locales: string[];
  referrers: (string | null)[];
}

export interface SeedSource {
  profile: {
    fullName: string;
    headline: LocalizedText;
    location: string;
    timezone: string;
    phone: string;
    email: string;
    yearsOfExperience: number;
    socialLinks?: SeedSocialLink[];
    featuredRepositories?: SeedFeaturedRepository[];
    summary: LocalizedText;
    availability: {
      modality: LocalizedText;
      contractType: LocalizedText;
      startDate: LocalizedText;
    };
    languages: SeedLanguage[];
  };
  experiences: SeedExperience[];
  skillCategories: SeedSkillCategory[];
  education: SeedEducation[];
  certifications: SeedCertification[];
  projects: SeedProject[];
  profileTemplates: SeedTemplate[];
  exampleViews?: SeedExampleViews[];
}

export interface SeedSourceError {
  /** Ruta del campo, por ejemplo `profileTemplates[3].accessToken`. */
  path: string;
  message: string;
}

/** Mismo patrón de slug que el panel. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Slug del perfil que el seed crea siempre. */
export const ALL_PROFILE_SLUG = 'all';
export const REF_KINDS = ['experience', 'project', 'skill'] as const;
export type RefKind = (typeof REF_KINDS)[number];

const VISIBILITIES: readonly string[] = ['PUBLIC', 'PROTECTED', 'PRIVATE'];
const LAYOUTS: readonly string[] = ['classic', 'sidebar'];
const THEME_SLUGS: readonly string[] = THEME_PRESETS.map((t) => t.slug);

// ── Validación ───────────────────────────────────────────────────
type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => v !== null && typeof v === 'object' && !Array.isArray(v);

class Checker {
  readonly errors: SeedSourceError[] = [];

  add(path: string, message: string): void {
    this.errors.push({ path, message });
  }

  rec(v: unknown, path: string): Rec | null {
    if (!isRec(v)) {
      this.add(path, 'debe ser un objeto');
      return null;
    }
    return v;
  }

  list(v: unknown, path: string): unknown[] | null {
    if (!Array.isArray(v)) {
      this.add(path, 'debe ser una lista');
      return null;
    }
    return v as unknown[];
  }

  str(v: unknown, path: string, optional = false): string | undefined {
    if (v === undefined && optional) return undefined;
    if (typeof v !== 'string' || v.trim() === '') {
      this.add(path, 'debe ser un texto no vacío');
      return undefined;
    }
    return v;
  }

  /** Texto plano que puede ser vacío (`endDate`, `description`…). */
  bool(v: unknown, path: string, optional = false): boolean | undefined {
    if (v === undefined && optional) return undefined;
    if (typeof v !== 'boolean') {
      this.add(path, 'debe ser verdadero o falso');
      return undefined;
    }
    return v;
  }

  strOrNull(v: unknown, path: string): void {
    if (v !== null && (typeof v !== 'string' || v.trim() === '')) {
      this.add(path, 'debe ser un texto o null');
    }
  }

  strings(v: unknown, path: string, optional = false): string[] | undefined {
    if (v === undefined && optional) return undefined;
    const items = this.list(v, path);
    if (!items) return undefined;
    items.forEach((item, i) => {
      if (typeof item !== 'string') this.add(`${path}[${i}]`, 'debe ser un texto');
    });
    return items.filter((item): item is string => typeof item === 'string');
  }

  /** `{ es, en? }`: `es` es obligatorio; `en` puede faltar (es lo que detecta el aviso de faltantes). */
  text(v: unknown, path: string, optional = false): void {
    if (v === undefined && optional) return;
    const r = this.rec(v, path);
    if (!r) return;
    this.str(r['es'], `${path}.es`);
    if (r['en'] !== undefined && typeof r['en'] !== 'string') {
      this.add(`${path}.en`, 'debe ser un texto');
    }
  }

  textList(v: unknown, path: string): void {
    const r = this.rec(v, path);
    if (!r) return;
    this.strings(r['es'], `${path}.es`);
    if (r['en'] !== undefined) this.strings(r['en'], `${path}.en`);
  }

  slug(v: unknown, path: string): string | undefined {
    const s = this.str(v, path);
    if (s !== undefined && !SLUG_PATTERN.test(s)) {
      this.add(path, 'solo admite minúsculas, dígitos y guiones (kebab-case)');
      return undefined;
    }
    return s;
  }

  sectionIds(v: unknown, path: string, unique: boolean): void {
    const items = this.strings(v, path, true);
    if (!items) return;
    const seen = new Set<string>();
    items.forEach((id, i) => {
      if (!(SECTION_IDS as readonly string[]).includes(id)) {
        this.add(`${path}[${i}]`, `"${id}" no está en el catálogo (${SECTION_IDS.join(', ')})`);
      } else if (unique && seen.has(id)) {
        this.add(`${path}[${i}]`, `"${id}" está repetido`);
      }
      seen.add(id);
    });
  }
}

interface RefIndex {
  experience: Set<string>;
  project: Set<string>;
  /** Nombre de skill → cuántas veces aparece en todo el archivo. */
  skill: Map<string, number>;
}

export function skillName(skill: string | SeedSkill): string {
  return typeof skill === 'string' ? skill : skill.name;
}

function buildRefIndex(raw: Rec): RefIndex {
  const idsOf = (key: string): string[] => {
    const items = Array.isArray(raw[key]) ? (raw[key] as unknown[]) : [];
    return items.flatMap((item) =>
      isRec(item) && typeof item['id'] === 'string' ? [item['id']] : [],
    );
  };
  const skill = new Map<string, number>();
  const cats = Array.isArray(raw['skillCategories']) ? (raw['skillCategories'] as unknown[]) : [];
  for (const cat of cats) {
    const skills = isRec(cat) && Array.isArray(cat['skills']) ? (cat['skills'] as unknown[]) : [];
    for (const s of skills) {
      const name =
        typeof s === 'string' ? s : isRec(s) && typeof s['name'] === 'string' ? s['name'] : null;
      if (name !== null) skill.set(name, (skill.get(name) ?? 0) + 1);
    }
  }
  return { experience: new Set(idsOf('experiences')), project: new Set(idsOf('projects')), skill };
}

export function parseRef(ref: string): { kind: RefKind; key: string } | null {
  const idx = ref.indexOf(':');
  if (idx <= 0) return null;
  const kind = ref.slice(0, idx);
  const key = ref.slice(idx + 1);
  if (!(REF_KINDS as readonly string[]).includes(kind) || key === '') return null;
  return { kind: kind as RefKind, key };
}

function checkRefs(c: Checker, v: unknown, path: string, index: RefIndex): void {
  const refs = c.strings(v, path, true);
  refs?.forEach((ref, i) => {
    const at = `${path}[${i}]`;
    const parsed = parseRef(ref);
    if (!parsed) {
      c.add(at, `referencia inválida "${ref}": usá experience:<id>, project:<id> o skill:<nombre>`);
    } else if (parsed.kind === 'skill') {
      const n = index.skill.get(parsed.key);
      if (n === undefined) c.add(at, `no existe ${ref}`);
      else if (n > 1) c.add(at, `${ref} es ambigua: el nombre aparece en ${n} categorías`);
    } else if (!index[parsed.kind].has(parsed.key)) {
      c.add(at, `no existe ${ref}`);
    }
  });
}

function checkProfile(c: Checker, v: unknown): void {
  const p = c.rec(v, 'profile');
  if (!p) return;
  for (const k of ['fullName', 'location', 'timezone', 'phone', 'email'])
    c.str(p[k], `profile.${k}`);
  if (typeof p['yearsOfExperience'] !== 'number') {
    c.add('profile.yearsOfExperience', 'debe ser un número');
  }
  c.text(p['headline'], 'profile.headline');
  c.text(p['summary'], 'profile.summary');
  const av = c.rec(p['availability'], 'profile.availability');
  if (av)
    for (const k of ['modality', 'contractType', 'startDate'])
      c.text(av[k], `profile.availability.${k}`);

  c.list(p['languages'], 'profile.languages')?.forEach((l, i) => {
    const at = `profile.languages[${i}]`;
    const r = c.rec(l, at);
    if (!r) return;
    c.str(r['name'], `${at}.name`);
    c.text(r['nameI18n'], `${at}.nameI18n`);
    c.text(r['level'], `${at}.level`);
    c.text(r['detail'], `${at}.detail`);
  });

  if (p['socialLinks'] !== undefined) {
    c.list(p['socialLinks'], 'profile.socialLinks')?.forEach((l, i) => {
      const at = `profile.socialLinks[${i}]`;
      const r = c.rec(l, at);
      if (!r) return;
      for (const k of ['platform', 'handle', 'url']) c.str(r[k], `${at}.${k}`);
      c.text(r['label'], `${at}.label`);
      c.text(r['description'], `${at}.description`, true);
      if (r['stats'] !== undefined) c.rec(r['stats'], `${at}.stats`);
      c.bool(r['featured'], `${at}.featured`);
      c.bool(r['visible'], `${at}.visible`);
    });
  }

  if (p['featuredRepositories'] !== undefined) {
    c.list(p['featuredRepositories'], 'profile.featuredRepositories')?.forEach((rp, i) => {
      const at = `profile.featuredRepositories[${i}]`;
      const r = c.rec(rp, at);
      if (!r) return;
      c.str(r['name'], `${at}.name`);
      c.str(r['url'], `${at}.url`);
      c.str(r['language'], `${at}.language`, true);
      c.text(r['description'], `${at}.description`);
      c.strings(r['tags'], `${at}.tags`);
      c.strings(r['technologies'], `${at}.technologies`, true);
      c.bool(r['visible'], `${at}.visible`);
    });
  }
}

function checkUniqueIds(c: Checker, items: unknown[], path: string): void {
  const seen = new Set<string>();
  items.forEach((item, i) => {
    const id = isRec(item) ? item['id'] : undefined;
    if (typeof id !== 'string') return;
    if (seen.has(id)) c.add(`${path}[${i}].id`, `el id "${id}" está repetido`);
    seen.add(id);
  });
}

const CREDENTIAL_FIELDS = ['verificationUrl', 'credentialId', 'expiresAt'] as const;

/**
 * Los tres campos opcionales de la credencial (`add-certification-verification`, D9): ausente o
 * `null` → sin valor; si no, las MISMAS reglas del dominio (`validateCertification`: https, largos,
 * formato del vencimiento y año coherente). El archivo no pasa por el DTO, así que sin esto un
 * `javascript:` podría cargarse. El error nombra el campo antes de borrar nada.
 */
function checkCertificationCredential(c: Checker, r: Rec, at: string): void {
  const values: Record<(typeof CREDENTIAL_FIELDS)[number], string | null> = {
    verificationUrl: null,
    credentialId: null,
    expiresAt: null,
  };
  for (const field of CREDENTIAL_FIELDS) {
    const v = r[field];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'string') {
      c.add(`${at}.${field}`, 'debe ser un texto o null');
      return;
    }
    values[field] = v;
  }
  const year = typeof r['year'] === 'string' && YEAR_REGEX.test(r['year']) ? r['year'] : null;
  const checked = validateCertification({
    name: { es: 'x' },
    issuer: 'x',
    year,
    ...values,
    order: 0,
    visible: true,
  });
  if (!checked.ok) {
    const field = checked.error.fields[0] ?? 'credencial';
    c.add(`${at}.${field}`, checked.error.message);
  }
}

function checkContent(c: Checker, raw: Rec): void {
  const experiences = c.list(raw['experiences'], 'experiences');
  experiences?.forEach((e, i) => {
    const at = `experiences[${i}]`;
    const r = c.rec(e, at);
    if (!r) return;
    for (const k of ['id', 'company', 'startDate', 'location']) c.str(r[k], `${at}.${k}`);
    c.strOrNull(r['endDate'], `${at}.endDate`);
    c.bool(r['current'], `${at}.current`);
    c.text(r['role'], `${at}.role`);
    c.text(r['summary'], `${at}.summary`);
    c.textList(r['highlights'], `${at}.highlights`);
    for (const k of ['sector', 'technologies', 'tags']) c.strings(r[k], `${at}.${k}`);
    c.bool(r['visible'], `${at}.visible`, true);
  });
  if (experiences) checkUniqueIds(c, experiences, 'experiences');

  c.list(raw['skillCategories'], 'skillCategories')?.forEach((cat, i) => {
    const at = `skillCategories[${i}]`;
    const r = c.rec(cat, at);
    if (!r) return;
    c.text(r['name'], `${at}.name`);
    c.strings(r['tags'], `${at}.tags`, true);
    c.list(r['skills'], `${at}.skills`)?.forEach((s, j) => {
      const sa = `${at}.skills[${j}]`;
      if (typeof s === 'string') {
        if (s.trim() === '') c.add(sa, 'debe ser un texto no vacío');
        return;
      }
      const sr = c.rec(s, sa);
      if (!sr) return;
      c.str(sr['name'], `${sa}.name`);
      c.strings(sr['tags'], `${sa}.tags`, true);
    });
  });

  c.list(raw['education'], 'education')?.forEach((ed, i) => {
    const at = `education[${i}]`;
    const r = c.rec(ed, at);
    if (!r) return;
    c.text(r['degree'], `${at}.degree`);
    c.str(r['institution'], `${at}.institution`);
    c.str(r['startDate'], `${at}.startDate`);
    c.strOrNull(r['endDate'], `${at}.endDate`);
    c.bool(r['inProgress'], `${at}.inProgress`);
    c.bool(r['visible'], `${at}.visible`, true);
  });

  c.list(raw['certifications'], 'certifications')?.forEach((ce, i) => {
    const at = `certifications[${i}]`;
    const r = c.rec(ce, at);
    if (!r) return;
    c.text(r['name'], `${at}.name`);
    c.str(r['issuer'], `${at}.issuer`);
    c.strOrNull(r['year'], `${at}.year`);
    checkCertificationCredential(c, r, at);
    c.bool(r['visible'], `${at}.visible`, true);
  });

  const projects = c.list(raw['projects'], 'projects');
  projects?.forEach((pr, i) => {
    const at = `projects[${i}]`;
    const r = c.rec(pr, at);
    if (!r) return;
    for (const k of ['id', 'name', 'period']) c.str(r[k], `${at}.${k}`);
    c.text(r['role'], `${at}.role`);
    c.text(r['summary'], `${at}.summary`);
    c.strings(r['technologies'], `${at}.technologies`);
    c.strings(r['tags'], `${at}.tags`);
    c.strOrNull(r['url'], `${at}.url`);
    c.bool(r['visible'], `${at}.visible`, true);
  });
  if (projects) checkUniqueIds(c, projects, 'projects');
}

function checkTemplates(c: Checker, raw: Rec, index: RefIndex): Set<string> {
  const slugs = new Set<string>([ALL_PROFILE_SLUG]);
  const aliasOwner = new Map<string, string>();
  const templates = c.list(raw['profileTemplates'], 'profileTemplates');
  if (!templates) return slugs;

  // Primero los slugs de todas las plantillas: un alias no puede coincidir con ninguno.
  const slugOf: (string | undefined)[] = templates.map((t, i) => {
    const s = isRec(t) ? c.slug(t['slug'], `profileTemplates[${i}].slug`) : undefined;
    if (s === undefined) return undefined;
    if (slugs.has(s)) {
      c.add(
        `profileTemplates[${i}].slug`,
        s === ALL_PROFILE_SLUG
          ? `"${s}" está reservado: lo crea el seed`
          : `el slug "${s}" está repetido`,
      );
    }
    slugs.add(s);
    return s;
  });

  templates.forEach((t, i) => {
    const at = `profileTemplates[${i}]`;
    const r = c.rec(t, at);
    if (!r) return;
    c.text(r['title'], `${at}.title`);
    c.text(r['description'], `${at}.description`);
    c.text(r['headline'], `${at}.headline`);
    c.text(r['roleType'], `${at}.roleType`, true);
    c.str(r['techFocus'], `${at}.techFocus`, true);
    c.strings(r['filterTags'], `${at}.filterTags`);
    if (r['themeOverrides'] !== undefined) c.rec(r['themeOverrides'], `${at}.themeOverrides`);
    c.bool(r['listed'], `${at}.listed`, true);
    c.bool(r['archived'], `${at}.archived`, true);

    if (
      r['theme'] !== undefined &&
      (typeof r['theme'] !== 'string' || !THEME_SLUGS.includes(r['theme']))
    ) {
      c.add(`${at}.theme`, `debe ser un preset: ${THEME_SLUGS.join(', ')}`);
    }
    if (
      r['layout'] !== undefined &&
      (typeof r['layout'] !== 'string' || !LAYOUTS.includes(r['layout']))
    ) {
      c.add(`${at}.layout`, `debe ser ${LAYOUTS.join(' o ')}`);
    }
    const visibility = r['visibility'];
    if (
      visibility !== undefined &&
      (typeof visibility !== 'string' || !VISIBILITIES.includes(visibility))
    ) {
      c.add(`${at}.visibility`, `debe ser ${VISIBILITIES.join(', ')}`);
    }
    if (visibility === 'PROTECTED') {
      if (typeof r['accessToken'] !== 'string' || r['accessToken'].trim() === '') {
        c.add(`${at}.accessToken`, 'es obligatorio en un perfil PROTECTED');
      }
    } else if (r['accessToken'] !== undefined) {
      c.str(r['accessToken'], `${at}.accessToken`);
    }

    c.sectionIds(r['sectionsOrder'], `${at}.sectionsOrder`, true);
    c.sectionIds(r['sectionsHidden'], `${at}.sectionsHidden`, false);
    checkRefs(c, r['includeRefs'], `${at}.includeRefs`, index);
    checkRefs(c, r['excludeRefs'], `${at}.excludeRefs`, index);

    c.strings(r['slugAliases'], `${at}.slugAliases`, true)?.forEach((alias, j) => {
      const ap = `${at}.slugAliases[${j}]`;
      if (!SLUG_PATTERN.test(alias)) {
        c.add(ap, 'solo admite minúsculas, dígitos y guiones (kebab-case)');
      } else if (slugs.has(alias)) {
        c.add(ap, `el alias "${alias}" coincide con el slug de un perfil`);
      } else if (aliasOwner.has(alias)) {
        c.add(ap, `el alias "${alias}" ya lo usa ${aliasOwner.get(alias)}`);
      } else {
        aliasOwner.set(alias, slugOf[i] ?? at);
      }
    });
  });
  return slugs;
}

function checkExampleViews(c: Checker, raw: Rec, slugs: Set<string>): void {
  if (raw['exampleViews'] === undefined) return;
  c.list(raw['exampleViews'], 'exampleViews')?.forEach((v, i) => {
    const at = `exampleViews[${i}]`;
    const r = c.rec(v, at);
    if (!r) return;
    const slug = c.str(r['slug'], `${at}.slug`);
    if (slug !== undefined && !slugs.has(slug))
      c.add(`${at}.slug`, `no existe el perfil "${slug}"`);
    for (const k of ['count', 'daysBack']) {
      const n = r[k];
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) {
        c.add(`${at}.${k}`, 'debe ser un entero mayor o igual a 1');
      }
    }
    const locales = c.strings(r['locales'], `${at}.locales`);
    if (locales && locales.length === 0) c.add(`${at}.locales`, 'no puede estar vacía');
    const refs = c.list(r['referrers'], `${at}.referrers`);
    if (refs) {
      if (refs.length === 0) c.add(`${at}.referrers`, 'no puede estar vacía');
      refs.forEach((ref, j) => {
        if (ref !== null && typeof ref !== 'string')
          c.add(`${at}.referrers[${j}]`, 'debe ser un texto o null');
      });
    }
  });
}

/** Valida la fuente completa. No escribe nada: es lo primero que corre el seed. */
export function parseSeedSource(raw: unknown): Result<SeedSource, SeedSourceError[]> {
  const c = new Checker();
  const root = c.rec(raw, '(raíz)');
  if (!root) return fail(c.errors);

  checkProfile(c, root['profile']);
  checkContent(c, root);
  const slugs = checkTemplates(c, root, buildRefIndex(root));
  checkExampleViews(c, root, slugs);

  return c.errors.length > 0 ? fail(c.errors) : ok(raw as SeedSource);
}

export function formatSeedErrors(errors: readonly SeedSourceError[]): string {
  return errors.map((e) => `  - ${e.path}: ${e.message}`).join('\n');
}

// ── Referencias (D7) ─────────────────────────────────────────────
export interface CreatedIds {
  experience: ReadonlyMap<string, string>;
  project: ReadonlyMap<string, string>;
  /** Nombre de skill → id generado. */
  skill: ReadonlyMap<string, string>;
}

/** Traduce `experience:<id>`, `project:<id>` y `skill:<nombre>` al id generado por la base. */
export function resolveRefs(refs: readonly string[], created: CreatedIds): string[] {
  return refs.map((ref) => {
    const parsed = parseRef(ref);
    const id = parsed ? created[parsed.kind].get(parsed.key) : undefined;
    if (id === undefined) throw new Error(`Referencia sin resolver: ${ref}`);
    return id;
  });
}

/** Nombre legible de cada referencia (empresa, proyecto o skill), para comparar sin ids. */
export function refDisplayName(ref: string, source: SeedSource): string | null {
  const parsed = parseRef(ref);
  if (!parsed) return null;
  if (parsed.kind === 'experience') {
    const e = source.experiences.find((x) => x.id === parsed.key);
    return e ? `experience:${e.company}` : null;
  }
  if (parsed.kind === 'project') {
    const p = source.projects.find((x) => x.id === parsed.key);
    return p ? `project:${p.name}` : null;
  }
  return `skill:${parsed.key}`;
}

// ── Conteos esperados ────────────────────────────────────────────
export function expectedCounts(
  source: SeedSource,
  themePresetCount: number,
): Record<string, number> {
  return {
    Profile: 1,
    Language: source.profile.languages.length,
    Experience: source.experiences.length,
    SkillCategory: source.skillCategories.length,
    Skill: source.skillCategories.reduce((acc, c) => acc + c.skills.length, 0),
    Education: source.education.length,
    Certification: source.certifications.length,
    Project: source.projects.length,
    SocialLink: (source.profile.socialLinks ?? []).length,
    FeaturedRepository: (source.profile.featuredRepositories ?? []).filter((r) => r.visible).length,
    Theme: themePresetCount,
    // Las plantillas más el perfil `all` que el seed crea siempre.
    CuratedProfile: source.profileTemplates.length + 1,
    CuratedProfileSlugAlias: source.profileTemplates.reduce(
      (acc, t) => acc + (t.slugAliases ?? []).length,
      0,
    ),
    ProfileView: (source.exampleViews ?? []).reduce((acc, v) => acc + v.count, 0),
  };
}

// ── Visitas sintéticas (D8) ──────────────────────────────────────
export interface SyntheticView {
  locale: string;
  referrer: string | null;
  userAgent: string;
  ipHash: null;
  viewedAt: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * La visita `i` cae `i % daysBack` días antes del día de la carga, a las 12:00 UTC, con
 * `locales[i % n]` y `referrers[i % m]`. Si las 12:00 UTC de hoy todavía no llegaron, la
 * visita se ancla a `now` para no quedar en el futuro.
 */
export function buildSyntheticViews(entry: SeedExampleViews, now: Date): SyntheticView[] {
  const noonToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12);
  return Array.from({ length: entry.count }, (_, i) => {
    const at = Math.min(noonToday - (i % entry.daysBack) * DAY_MS, now.getTime());
    return {
      locale: entry.locales[i % entry.locales.length],
      referrer: entry.referrers[i % entry.referrers.length],
      userAgent: 'example-seed',
      ipHash: null,
      viewedAt: new Date(at),
    };
  });
}

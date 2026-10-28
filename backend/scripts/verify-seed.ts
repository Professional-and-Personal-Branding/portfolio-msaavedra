/**
 * Verifica que la base contenga exactamente lo que describe la fuente del seed
 * (spec `data-persistence-seed` y `example-seed-data`). Los conteos esperados se calculan en
 * runtime a partir del JSON: si los datos cambian, la verificación sigue siendo válida.
 *
 *   npm run seed:verify                        → docs/cv-data.json
 *   npm run seed:verify -- --file <ruta>       → otro archivo
 *   npm run seed:example:verify                → docs/examples/cv-data.example.json
 *
 * No escribe en la base. Salida: 0 si coincide, 1 si difiere o la fuente no es válida.
 */
import { PrismaClient } from '@prisma/client';
import { SECTION_IDS } from '../src/modules/curated-profile/domain/services/resolve-sections';
import { THEME_PRESETS } from './lib/seed-defaults';
import { DEFAULT_SEED_FILE, parseSeedArgs, readSeedFile } from './lib/seed-runner';
import {
  expectedCounts,
  formatSeedErrors,
  parseSeedSource,
  refDisplayName,
  SeedSource,
  SeedTemplate,
} from './lib/seed-source';

/** Dos textos bilingües son iguales si coinciden `es` y `en` (o ambos son el mismo texto plano). */
function sameLocalized(a: unknown, b: unknown): boolean {
  if (typeof a === 'string' || typeof b === 'string') return a === b;
  const pick = (v: unknown, key: 'es' | 'en'): unknown =>
    v !== null && typeof v === 'object' ? (v as Record<string, unknown>)[key] : undefined;
  return pick(a, 'es') === pick(b, 'es') && pick(a, 'en') === pick(b, 'en');
}

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && [...a].sort().join('\u0000') === [...b].sort().join('\u0000');

/** El acento de cada plantilla vive en themeOverrides.colors.accent (retire-accent-color, D11). */
const accentOf = (value: unknown): unknown => {
  const colors = (value as { colors?: { accent?: unknown } } | null | undefined)?.colors;
  return colors?.accent;
};

interface ProfileRow {
  visibility: string;
  listed: boolean;
  archivedAt: Date | null;
  layout: string;
  sectionsOrder: string[];
  sectionsHidden: string[];
  includeIds: string[];
  excludeIds: string[];
  themeOverrides: unknown;
  theme: { slug: string } | null;
  slugAliases: { slug: string }[];
}

/** Diferencias entre lo que declara la plantilla (con los defaults del seed) y lo que hay en la base. */
function templateDiffs(
  tpl: SeedTemplate,
  row: ProfileRow,
  data: SeedSource,
  namesOf: (ids: readonly string[]) => string[],
  fileMode: boolean,
): string[] {
  const diffs: string[] = [];
  const check = (
    field: string,
    expectedValue: unknown,
    actualValue: unknown,
    same: boolean = expectedValue === actualValue,
  ): void => {
    if (!same) {
      diffs.push(
        `${field}: esperado=${JSON.stringify(expectedValue)} actual=${JSON.stringify(actualValue)}`,
      );
    }
  };
  check('visibility', tpl.visibility ?? 'PUBLIC', row.visibility);
  check('listed', tpl.listed ?? true, row.listed);
  check('archivado', tpl.archived === true, row.archivedAt !== null);
  check('layout', tpl.layout ?? 'classic', row.layout);
  check('tema', tpl.theme ?? 'modern-dark', row.theme?.slug);
  const order = tpl.sectionsOrder ?? [...SECTION_IDS];
  check('sectionsOrder', order, row.sectionsOrder, order.join() === row.sectionsOrder.join());
  const hidden = tpl.sectionsHidden ?? [];
  check('sectionsHidden', hidden, row.sectionsHidden, sameSet(hidden, row.sectionsHidden));
  const aliases = tpl.slugAliases ?? [];
  const dbAliases = row.slugAliases.map((a) => a.slug);
  check('slugAliases', aliases, dbAliases, sameSet(aliases, dbAliases));
  const overrides: [string, readonly string[], readonly string[]][] = [
    ['includeIds', tpl.includeRefs ?? [], row.includeIds],
    ['excludeIds', tpl.excludeRefs ?? [], row.excludeIds],
  ];
  for (const [field, refs, ids] of overrides) {
    const wanted = refs.map((r) => refDisplayName(r, data) ?? r);
    const got = namesOf(ids);
    check(field, wanted, got, sameSet(wanted, got));
  }
  // El acento de cv-data.json es obligatorio por plantilla (retire-accent-color, D11); en el
  // ejemplo las plantillas sin override de color no lo declaran.
  const wantedAccent = accentOf(tpl.themeOverrides);
  const gotAccent = accentOf(row.themeOverrides);
  const accentOk = wantedAccent === gotAccent && (fileMode || wantedAccent !== undefined);
  check('colors.accent', wantedAccent, gotAccent, accentOk);
  return diffs;
}

async function main(): Promise<number> {
  const args = parseSeedArgs(process.argv.slice(2), process.cwd());
  if (!args.ok) {
    console.error(`❌ ${args.error}`);
    return 1;
  }
  if (args.value.overwrite) {
    console.error('❌ --overwrite solo aplica a npm run seed: seed:verify no escribe.');
    return 1;
  }
  const fileMode = args.value.file !== undefined;
  const file = args.value.file ?? DEFAULT_SEED_FILE;
  const raw = readSeedFile(file);
  if (!raw.ok) {
    console.error(`❌ ${raw.error}`);
    return 1;
  }
  const parsed = parseSeedSource(raw.value);
  if (!parsed.ok) {
    console.error(`❌ La fuente no cumple el formato:\n${formatSeedErrors(parsed.error)}`);
    return 1;
  }
  const data = parsed.value;
  const label = fileMode ? file : 'cv-data.json';
  const prisma = new PrismaClient();

  try {
    const expected = expectedCounts(data, THEME_PRESETS.length);
    const actual: Record<string, number> = {
      Profile: await prisma.profile.count(),
      Language: await prisma.language.count(),
      Experience: await prisma.experience.count(),
      SkillCategory: await prisma.skillCategory.count(),
      Skill: await prisma.skill.count(),
      Education: await prisma.education.count(),
      Certification: await prisma.certification.count(),
      Project: await prisma.project.count(),
      SocialLink: await prisma.socialLink.count(),
      FeaturedRepository: await prisma.featuredRepository.count(),
      Theme: await prisma.theme.count(),
      CuratedProfile: await prisma.curatedProfile.count(),
      CuratedProfileSlugAlias: await prisma.curatedProfileSlugAlias.count(),
      ProfileView: await prisma.profileView.count(),
    };

    let failures = 0;
    console.log(`🔎 Verificación del seed (esperado ← ${label} / actual ← DB)`);
    for (const table of Object.keys(expected)) {
      const okRow = expected[table] === actual[table];
      if (!okRow) failures++;
      console.log(
        `  ${okRow ? '✅' : '❌'} ${table.padEnd(24)} esperado=${expected[table]}  actual=${actual[table]}`,
      );
    }

    // Los datos bilingües deben preservarse tal cual en la base: se mira la primera experiencia.
    const first = data.experiences[0];
    if (first) {
      const row = await prisma.experience.findFirst({ where: { company: first.company } });
      const role = row?.role as Record<string, unknown> | null | undefined;
      const bilingual = !!role && typeof role['es'] === 'string' && typeof role['en'] === 'string';
      console.log(
        `  ${bilingual ? '✅' : '❌'} Experience.role bilingüe (es/en) en ${first.company}`,
      );
      if (!bilingual) failures++;
    }

    // El nivel de cada idioma es texto bilingüe y debe coincidir con la fuente (localize-language-level, D5).
    const dbLanguages = await prisma.language.findMany();
    for (const lang of data.profile.languages) {
      const row = dbLanguages.find((l) => l.name === lang.name);
      // jsonb no conserva el orden de las claves: se compara por idioma, no por texto serializado.
      const okLevel = !!row && sameLocalized(row.level, lang.level);
      if (!okLevel) failures++;
      console.log(
        `  ${okLevel ? '✅' : '❌'} Language.level de ${lang.name} (fuente=${JSON.stringify(lang.level)}, db=${JSON.stringify(row?.level)})`,
      );
    }

    // Mapas id → "tipo:nombre" para comparar los overrides por nombre y no por id generado.
    const nameById = new Map<string, string>();
    for (const e of await prisma.experience.findMany({ select: { id: true, company: true } })) {
      nameById.set(e.id, `experience:${e.company}`);
    }
    for (const p of await prisma.project.findMany({ select: { id: true, name: true } })) {
      nameById.set(p.id, `project:${p.name}`);
    }
    for (const s of await prisma.skill.findMany({ select: { id: true, name: true } })) {
      nameById.set(s.id, `skill:${s.name}`);
    }
    const namesOf = (ids: readonly string[]): string[] =>
      ids.map((id) => nameById.get(id) ?? `?${id}`);

    const profiles = await prisma.curatedProfile.findMany({
      include: { theme: { select: { slug: true } }, slugAliases: { select: { slug: true } } },
    });
    for (const tpl of data.profileTemplates) {
      const row = profiles.find((p) => p.slug === tpl.slug);
      const diffs = row
        ? templateDiffs(tpl, row, data, namesOf, fileMode)
        : ['no existe en la base'];
      if (diffs.length > 0) failures++;
      console.log(
        `  ${diffs.length === 0 ? '✅' : '❌'} ${tpl.slug.padEnd(24)} ${row?.visibility} listed=${row?.listed} archivado=${row?.archivedAt ? 'sí' : 'no'} layout=${row?.layout} tema=${row?.theme?.slug} accent=${String(accentOf(row?.themeOverrides))}`,
      );
      for (const d of diffs) console.log(`       ↳ ${tpl.slug}: ${d}`);
    }

    if (failures > 0) {
      console.error(`❌ ${failures} verificación(es) fallida(s).`);
      return 1;
    }
    console.log(`✅ La base coincide con ${label}.`);
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((e: unknown) => {
    console.error('❌ Error verificando el seed:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });

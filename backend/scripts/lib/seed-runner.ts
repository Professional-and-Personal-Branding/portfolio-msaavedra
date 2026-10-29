/**
 * Orquestación del seed: argumentos, lectura y validación de la fuente, negativa (`--file`) y
 * escritura. `scripts/seed.ts` es solo la entrada de línea de comandos; todo lo demás vive acá
 * para poder probarlo con un cliente de Prisma simulado.
 *
 * Códigos de salida: 0 ok · 1 fuente ausente o inválida, error de uso o falla al contar ·
 * 2 negativa (`--file` sobre una base no descartable, o el seed por defecto sobre una base con
 * contenido sin `--overwrite`).
 */
import { Prisma, PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fail, ok, Result } from '../../src/shared/domain/result';
import { SECTION_IDS } from '../../src/modules/curated-profile/domain/services/resolve-sections';
import { tagsForSkillCategory, THEME_PRESETS } from './seed-defaults';
import {
  ALL_PROFILE_SLUG,
  buildSyntheticViews,
  CreatedIds,
  formatSeedErrors,
  parseRef,
  parseSeedSource,
  resolveRefs,
  SeedSource,
  skillName,
} from './seed-source';
import {
  describeDatabaseTarget,
  evaluateContentLayer,
  evaluateDefaultSeed,
  evaluateEnvLayers,
  formatCountFailure,
  formatDefaultSeedRefusal,
  formatGuardFailure,
  formatOverwriteWarning,
  loadContentCounts,
  loadExistingProfileNames,
  SEED_GUARD_EXIT_CODE,
  SeedGuardFailure,
} from './seed-guard';

/** Fuente por defecto: la trayectoria real del owner, relativa a `backend/scripts/`. */
export const DEFAULT_SEED_FILE = path.resolve(__dirname, '../../../docs/cv-data.json');

// ── Argumentos ───────────────────────────────────────────────────
export interface SeedArgs {
  /** Ruta absoluta del archivo alternativo; `undefined` = `docs/cv-data.json`. */
  file?: string;
  /** `--overwrite`: recarga aunque la base tenga contenido (solo sin `--file`). */
  overwrite: boolean;
}

/** `--file <ruta>` o `--file=<ruta>` (resuelta contra el directorio actual) y `--overwrite`. */
export function parseSeedArgs(argv: readonly string[], cwd: string): Result<SeedArgs, string> {
  let file: string | undefined;
  let overwrite = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--file') {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) return fail('--file necesita una ruta');
      file = next;
      i++;
    } else if (arg.startsWith('--file=')) {
      file = arg.slice('--file='.length);
      if (file === '') return fail('--file necesita una ruta');
    } else if (arg === '--overwrite') {
      overwrite = true;
    } else {
      return fail(`argumento desconocido: ${arg}`);
    }
  }
  if (overwrite && file !== undefined) {
    return fail(
      '--overwrite no se combina con --file: un archivo alternativo tiene su propia negativa (ver docs/DATA-POPULATION.md § 11).',
    );
  }
  return ok(file === undefined ? { overwrite } : { overwrite, file: path.resolve(cwd, file) });
}

/** Lee el archivo y lo parsea como JSON; no valida el formato. */
export function readSeedFile(filePath: string): Result<unknown, string> {
  if (!fs.existsSync(filePath)) return fail(`no existe el archivo ${filePath}`);
  try {
    return ok(JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown);
  } catch (e) {
    return fail(`${filePath} no es JSON válido: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ── Orquestador ──────────────────────────────────────────────────
export interface RunSeedOptions {
  /** Hay `--file`: se aplica la negativa de tres capas. */
  guarded: boolean;
  /** `--overwrite` sin `--file`. */
  overwrite?: boolean;
  env: Readonly<Record<string, string | undefined>>;
  now?: Date;
  log?: (message: string) => void;
  error?: (message: string) => void;
}

/**
 * Valida la fuente, cuenta (sin `--file`) o aplica la negativa de tres capas (con `--file`) y
 * recién entonces escribe.
 * Devuelve el código de salida; no toca `process`.
 */
export async function executeSeed(
  prisma: PrismaClient,
  raw: unknown,
  options: RunSeedOptions,
): Promise<number> {
  const log = options.log ?? ((m: string) => console.log(m));
  const error = options.error ?? ((m: string) => console.error(m));

  // 1. Validación completa antes de borrar nada (también sin --file).
  const parsed = parseSeedSource(raw);
  if (!parsed.ok) {
    error(`❌ La fuente del seed no cumple el formato:\n${formatSeedErrors(parsed.error)}`);
    error('No se escribió nada.');
    return 1;
  }
  const source = parsed.value;

  // 2. Negativa (solo con --file): variable y NODE_ENV primero, sin conectarse; después el contenido.
  if (options.guarded) {
    const target = describeDatabaseTarget(options.env['DATABASE_URL']);
    let failures: SeedGuardFailure[] = evaluateEnvLayers(options.env);
    if (failures.length === 0) {
      const names = await loadExistingProfileNames(prisma);
      const content = evaluateContentLayer(names, source.profile.fullName);
      failures = content ? [content] : [];
    }
    if (failures.length > 0) {
      error(`❌ ${formatGuardFailure(failures, target)}`);
      return SEED_GUARD_EXIT_CODE;
    }
    log(`🛡️  Base descartable confirmada: ${target}`);
  }

  // 3. Seed por defecto: contar, decidir (protect-default-seed, D1–D6). No se escribe antes.
  if (!options.guarded) {
    const target = describeDatabaseTarget(options.env['DATABASE_URL']);
    const now = options.now ?? new Date();
    let counts: Awaited<ReturnType<typeof loadContentCounts>>;
    try {
      counts = await loadContentCounts(prisma);
    } catch (e) {
      error(formatCountFailure(target, e, options.env['DATABASE_URL']));
      return 1;
    }
    const decision = evaluateDefaultSeed({
      counts,
      overwrite: options.overwrite ?? false,
      env: options.env,
    });
    if (decision.action === 'refuse') {
      error(
        `❌ ${formatDefaultSeedRefusal({
          reason: decision.reason,
          target,
          counts,
          databaseUrl: options.env['DATABASE_URL'],
          now,
        })}`,
      );
      return SEED_GUARD_EXIT_CODE;
    }
    if (decision.action === 'load-overwrite') {
      log(formatOverwriteWarning(target, counts, decision.production));
    }
  }

  await writeSeed(prisma, source, options.now ?? new Date(), log);
  return 0;
}

// ── Escritura ────────────────────────────────────────────────────
async function writeSeed(
  prisma: PrismaClient,
  data: SeedSource,
  now: Date,
  log: (message: string) => void,
): Promise<void> {
  log('🌱 Iniciando seed...');

  // ── Limpieza (orden respetando FKs) ──
  log('🧹 Limpiando tablas...');
  await prisma.profileView.deleteMany();
  await prisma.curatedProfile.deleteMany();
  await prisma.theme.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.skillCategory.deleteMany();
  await prisma.experience.deleteMany();
  await prisma.language.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.education.deleteMany();
  await prisma.certification.deleteMany();
  await prisma.project.deleteMany();
  await prisma.socialLink.deleteMany();
  await prisma.featuredRepository.deleteMany();

  // ── Profile ──
  log('👤 Creando perfil base...');
  await prisma.profile.create({
    data: {
      fullName: data.profile.fullName,
      headline: data.profile.headline,
      location: data.profile.location,
      timezone: data.profile.timezone,
      email: data.profile.email,
      phone: data.profile.phone,
      summary: data.profile.summary,
      yearsOfExperience: data.profile.yearsOfExperience,
      availModality: data.profile.availability.modality,
      availContractType: data.profile.availability.contractType,
      availStartDate: data.profile.availability.startDate,
      languages: {
        create: data.profile.languages.map((l) => ({
          name: l.name,
          nameI18n: l.nameI18n,
          level: l.level,
          detail: l.detail,
        })),
      },
    },
  });

  const created: {
    experience: Map<string, string>;
    project: Map<string, string>;
    skill: Map<string, string>;
  } = { experience: new Map(), project: new Map(), skill: new Map() };

  // ── Experiences (orden cronológico inverso por índice del array) ──
  log(`💼 Creando ${data.experiences.length} experiencias...`);
  for (let i = 0; i < data.experiences.length; i++) {
    const e = data.experiences[i];
    const row = await prisma.experience.create({
      data: {
        company: e.company,
        role: e.role,
        startDate: e.startDate,
        endDate: e.endDate,
        current: e.current,
        location: e.location,
        summary: e.summary,
        highlights: e.highlights,
        technologies: e.technologies,
        tags: e.tags,
        sector: e.sector,
        order: i,
        visible: e.visible ?? true,
      },
    });
    created.experience.set(e.id, row.id);
  }

  // ── Skill categories + skills ──
  log(`🛠️  Creando ${data.skillCategories.length} categorías de skills...`);
  for (let i = 0; i < data.skillCategories.length; i++) {
    const cat = data.skillCategories[i];
    const catTags = cat.tags ?? tagsForSkillCategory(cat.name.es);
    await prisma.skillCategory.create({
      data: {
        name: cat.name,
        order: i,
        skills: {
          create: cat.skills.map((s, j) => ({
            name: skillName(s),
            tags: typeof s === 'string' ? catTags : (s.tags ?? catTags),
            order: j,
          })),
        },
      },
    });
  }

  // ── Education ──
  log(`🎓 Creando ${data.education.length} registros de educación...`);
  for (let i = 0; i < data.education.length; i++) {
    const ed = data.education[i];
    await prisma.education.create({
      data: {
        degree: ed.degree,
        institution: ed.institution,
        startDate: ed.startDate,
        endDate: ed.endDate,
        inProgress: ed.inProgress,
        order: i,
        ...(ed.visible === undefined ? {} : { visible: ed.visible }),
      },
    });
  }

  // ── Certifications ──
  log(`📜 Creando ${data.certifications.length} certificaciones...`);
  for (let i = 0; i < data.certifications.length; i++) {
    const c = data.certifications[i];
    await prisma.certification.create({
      data: {
        name: c.name,
        issuer: c.issuer,
        year: c.year,
        // Ausentes → no se escriben (la columna queda en NULL): con cv-data.json las llamadas
        // son idénticas a las de antes del change `add-certification-verification`.
        ...(c.verificationUrl ? { verificationUrl: c.verificationUrl } : {}),
        ...(c.credentialId ? { credentialId: c.credentialId } : {}),
        ...(c.expiresAt ? { expiresAt: c.expiresAt } : {}),
        order: i,
        ...(c.visible === undefined ? {} : { visible: c.visible }),
      },
    });
  }

  // ── Projects ──
  log(`🚀 Creando ${data.projects.length} proyectos...`);
  for (let i = 0; i < data.projects.length; i++) {
    const pr = data.projects[i];
    const row = await prisma.project.create({
      data: {
        name: pr.name,
        role: pr.role,
        period: pr.period,
        summary: pr.summary,
        technologies: pr.technologies,
        tags: pr.tags,
        url: pr.url,
        order: i,
        visible: pr.visible ?? true,
      },
    });
    created.project.set(pr.id, row.id);
  }

  // ── Social links (GitHub, YouTube, etc.) ──
  const links = data.profile.socialLinks ?? [];
  log(`🔗 Creando ${links.length} enlaces sociales...`);
  for (let i = 0; i < links.length; i++) {
    const l = links[i];
    await prisma.socialLink.create({
      data: {
        platform: l.platform,
        handle: l.handle,
        url: l.url,
        label: l.label,
        description: l.description ?? undefined,
        stats: (l.stats as Prisma.InputJsonObject | undefined) ?? undefined,
        featured: l.featured,
        visible: l.visible,
        order: i,
      },
    });
  }

  // ── Featured repositories (curaduría manual) ──
  const repos = (data.profile.featuredRepositories ?? []).filter((r) => r.visible);
  log(`📦 Creando ${repos.length} repositorios destacados...`);
  for (let i = 0; i < repos.length; i++) {
    const r = repos[i];
    await prisma.featuredRepository.create({
      data: {
        name: r.name,
        url: r.url,
        language: r.language ?? null,
        description: r.description,
        tags: r.tags,
        technologies: r.technologies ?? [],
        stars: r.stars ?? null,
        order: i,
        visible: r.visible,
      },
    });
  }

  // ── Themes (presets) ──
  log(`🎨 Creando ${THEME_PRESETS.length} temas preset...`);
  const themeBySlug: Record<string, string> = {};
  for (const t of THEME_PRESETS) {
    const row = await prisma.theme.create({
      data: { name: t.name, slug: t.slug, isPreset: t.isPreset, tokens: t.tokens },
    });
    themeBySlug[t.slug] = row.id;
  }

  // Las skills se referencian por nombre: solo se consultan si alguna plantilla las usa.
  const usesSkillRefs = data.profileTemplates.some((t) =>
    [...(t.includeRefs ?? []), ...(t.excludeRefs ?? [])].some((r) => parseRef(r)?.kind === 'skill'),
  );
  if (usesSkillRefs) {
    const skills = await prisma.skill.findMany({ select: { id: true, name: true } });
    for (const s of skills) created.skill.set(s.name, s.id);
  }
  const ids: CreatedIds = created;

  // ── Curated profiles (desde profileTemplates) ──
  log(`⭐ Creando ${data.profileTemplates.length} perfiles curados...`);
  const profileIdBySlug = new Map<string, string>();
  for (const tpl of data.profileTemplates) {
    const include = tpl.includeRefs?.length ? resolveRefs(tpl.includeRefs, ids) : undefined;
    const exclude = tpl.excludeRefs?.length ? resolveRefs(tpl.excludeRefs, ids) : undefined;
    const row = await prisma.curatedProfile.create({
      data: {
        slug: tpl.slug,
        title: tpl.title,
        headline: tpl.headline,
        description: tpl.description,
        filterTags: tpl.filterTags,
        roleType: tpl.roleType ?? undefined,
        techFocus: tpl.techFocus ?? undefined,
        // Si la plantilla no lo trae, la columna queda en NULL.
        themeOverrides: tpl.themeOverrides as Prisma.InputJsonObject | undefined,
        listed: tpl.listed ?? true,
        themeId: themeBySlug[tpl.theme ?? 'modern-dark'],
        layout: tpl.layout ?? 'classic',
        // El catálogo completo del dominio: lo que se ve no depende del relleno.
        sectionsOrder: tpl.sectionsOrder ?? [...SECTION_IDS],
        visibility: tpl.visibility ?? 'PUBLIC',
        // Solo se escriben los campos del formato extendido que la plantilla declara.
        ...(tpl.sectionsHidden ? { sectionsHidden: tpl.sectionsHidden } : {}),
        ...(tpl.accessToken ? { accessToken: tpl.accessToken } : {}),
        ...(include ? { includeIds: include } : {}),
        ...(exclude ? { excludeIds: exclude } : {}),
        ...(tpl.archived ? { archivedAt: now } : {}),
        ...(tpl.slugAliases?.length
          ? { slugAliases: { create: tpl.slugAliases.map((slug) => ({ slug })) } }
          : {}),
      },
    });
    profileIdBySlug.set(tpl.slug, row.id);
  }

  // Perfil curado "all" (vista completa pública)
  const all = await prisma.curatedProfile.create({
    data: {
      slug: ALL_PROFILE_SLUG,
      title: { es: 'Perfil Completo', en: 'Full Profile' },
      // Sin titular propio: la home muestra el del perfil base, que se edita en
      // /admin/portada (add-profile-content-admin, D7).
      headline: {},
      description: {
        es: 'Vista completa del portafolio profesional.',
        en: 'Complete view of the professional portfolio.',
      },
      filterTags: [], // vacío = mostrar todo
      listed: true,
      themeOverrides: { colors: { accent: '#38bdf8' } },
      themeId: themeBySlug['modern-dark'],
      layout: 'classic',
      sectionsOrder: [...SECTION_IDS],
      visibility: 'PUBLIC',
    },
  });
  profileIdBySlug.set(ALL_PROFILE_SLUG, all.id);

  // ── Visitas sintéticas (solo el ejemplo las trae) ──
  for (const entry of data.exampleViews ?? []) {
    const profileId = profileIdBySlug.get(entry.slug);
    if (!profileId) continue; // la validación ya garantiza que existe
    const views = buildSyntheticViews(entry, now);
    log(`👁️  Creando ${views.length} visitas de ejemplo para ${entry.slug}...`);
    await prisma.profileView.createMany({
      data: views.map((v) => ({ ...v, curatedProfileId: profileId })),
    });
    await prisma.curatedProfile.update({
      where: { id: profileId },
      data: { views: { increment: views.length } },
    });
  }

  log('✅ Seed completado con éxito.');
}

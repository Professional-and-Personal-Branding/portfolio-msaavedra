/**
 * Verifica que la base contenga exactamente lo que describe docs/cv-data.json
 * (spec `data-persistence-seed`). Los conteos esperados se calculan en runtime a
 * partir del JSON: si los datos cambian, la verificación sigue siendo válida.
 *
 * Uso: npm run seed:verify  → exit 0 si coincide, 1 si difiere.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

interface CvDataCounts {
  profile: {
    languages: unknown[];
    socialLinks?: unknown[];
    featuredRepositories?: { visible: boolean }[];
  };
  experiences: unknown[];
  skillCategories: { skills: unknown[] }[];
  education: unknown[];
  certifications: unknown[];
  projects: unknown[];
  profileTemplates: { slug: string; themeOverrides?: unknown }[];
}

const THEME_PRESETS_COUNT = 5; // definidos en scripts/seed.ts
const EXTRA_CURATED_PROFILES = 1; // perfil "all" creado por el seed

async function main(): Promise<void> {
  const dataPath = path.resolve(__dirname, '../../docs/cv-data.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8')) as CvDataCounts;
  const prisma = new PrismaClient();

  const expected: Record<string, number> = {
    Profile: 1,
    Language: data.profile.languages.length,
    Experience: data.experiences.length,
    SkillCategory: data.skillCategories.length,
    Skill: data.skillCategories.reduce((acc, c) => acc + c.skills.length, 0),
    Education: data.education.length,
    Certification: data.certifications.length,
    Project: data.projects.length,
    SocialLink: (data.profile.socialLinks ?? []).length,
    FeaturedRepository: (data.profile.featuredRepositories ?? []).filter((r) => r.visible).length,
    Theme: THEME_PRESETS_COUNT,
    CuratedProfile: data.profileTemplates.length + EXTRA_CURATED_PROFILES,
    ProfileView: 0,
  };

  try {
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
      ProfileView: await prisma.profileView.count(),
    };

    let failures = 0;
    console.log('🔎 Verificación del seed (esperado ← cv-data.json / actual ← DB)');
    for (const table of Object.keys(expected)) {
      const okRow = expected[table] === actual[table];
      if (!okRow) failures++;
      console.log(
        `  ${okRow ? '✅' : '❌'} ${table.padEnd(20)} esperado=${expected[table]}  actual=${actual[table]}`,
      );
    }

    // Los datos bilingües deben preservarse tal cual en la base.
    const novacomp = await prisma.experience.findFirst({ where: { company: 'Novacomp' } });
    const role = novacomp?.role as Record<string, unknown> | null;
    const bilingual = !!role && typeof role['es'] === 'string' && typeof role['en'] === 'string';
    console.log(`  ${bilingual ? '✅' : '❌'} Experience.role bilingüe (es/en) en Novacomp`);
    if (!bilingual) failures++;

    // El acento de cada plantilla vive en themeOverrides.colors.accent (retire-accent-color, D11).
    const accentOf = (value: unknown): unknown => {
      const colors = (value as { colors?: { accent?: unknown } } | null | undefined)?.colors;
      return colors?.accent;
    };
    for (const tpl of data.profileTemplates) {
      const row = await prisma.curatedProfile.findUnique({ where: { slug: tpl.slug } });
      const expectedAccent = accentOf(tpl.themeOverrides);
      const okAccent =
        !!row && expectedAccent !== undefined && accentOf(row.themeOverrides) === expectedAccent;
      if (!okAccent) failures++;
      console.log(
        `  ${okAccent ? '✅' : '❌'} ${tpl.slug.padEnd(22)} colors.accent=${String(accentOf(row?.themeOverrides))} (cv-data=${String(expectedAccent)})`,
      );
    }

    if (failures > 0) {
      console.error(`❌ ${failures} verificación(es) fallida(s).`);
      process.exitCode = 1;
    } else {
      console.log('✅ La base coincide con cv-data.json.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error('❌ Error verificando el seed:', e instanceof Error ? e.message : e);
  process.exit(1);
});

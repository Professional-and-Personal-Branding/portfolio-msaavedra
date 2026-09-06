/**
 * Seed script — carga docs/cv-data.json en la base de datos.
 *
 * Uso (definir en package.json):
 *   "seed": "ts-node scripts/seed.ts"
 * o con tsx:
 *   "seed": "tsx scripts/seed.ts"
 *
 * Requiere que la migración inicial de Prisma ya esté aplicada:
 *   npm run prisma:migrate
 *
 * Idempotente: limpia las tablas relevantes antes de insertar.
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// ── Tipos del JSON de origen (cv-data.json, bilingüe) ────────────
type LocalizedText = { es: string; en: string };
type LocalizedList = { es: string[]; en: string[] };

interface CvData {
  profile: {
    fullName: string;
    headline: LocalizedText;
    location: string;
    timezone: string;
    phone: string;
    email: string;
    yearsOfExperience: number;
    socialLinks?: {
      platform: string;
      handle: string;
      url: string;
      label: LocalizedText;
      description?: LocalizedText;
      stats?: Record<string, unknown>;
      featured: boolean;
      visible: boolean;
    }[];
    featuredRepositories?: {
      name: string;
      url: string;
      language?: string;
      description: LocalizedText;
      tags: string[];
      technologies?: string[];
      stars?: number;
      visible: boolean;
    }[];
    summary: LocalizedText;
    availability: {
      modality: LocalizedText;
      contractType: LocalizedText;
      startDate: LocalizedText;
    };
    languages: { name: string; nameI18n: LocalizedText; level: string; detail: LocalizedText }[];
  };
  experiences: {
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
  }[];
  skillCategories: { name: LocalizedText; skills: string[] }[];
  education: {
    degree: LocalizedText;
    institution: string;
    startDate: string;
    endDate: string | null;
    inProgress: boolean;
  }[];
  certifications: { name: LocalizedText; issuer: string; year: string | null }[];
  profileTemplates: {
    slug: string;
    title: LocalizedText;
    description: LocalizedText;
    headline: LocalizedText;
    roleType?: LocalizedText;
    techFocus?: string;
    filterTags: string[];
    accentColor: string;
  }[];
  projects: {
    id: string;
    name: string;
    role: LocalizedText;
    period: string;
    summary: LocalizedText;
    technologies: string[];
    tags: string[];
    url: string | null;
    visible: boolean;
  }[];
}

// ── Presets de tema iniciales (alineados a demo-theming.html) ────
const THEME_PRESETS = [
  {
    name: 'Modern Dark',
    slug: 'modern-dark',
    isPreset: true,
    tokens: {
      mode: 'dark',
      colors: {
        bg: '#0a0e1a',
        bgSoft: '#111827',
        card: '#161d2e',
        border: '#252d42',
        text: '#e8edf5',
        textMuted: '#94a3b8',
        accent: '#38bdf8',
        accent2: '#818cf8',
      },
      typography: { fontSans: 'Inter', fontHeading: 'Inter', scale: 'default' },
      layout: { radius: '16px', maxWidth: '1080px', density: 'comfortable' },
      effects: { animations: true, glassmorphism: true },
    },
  },
  {
    name: 'Modern Light',
    slug: 'modern-light',
    isPreset: true,
    tokens: {
      mode: 'light',
      colors: {
        bg: '#f8fafc',
        bgSoft: '#f1f5f9',
        card: '#ffffff',
        border: '#e2e8f0',
        text: '#0f172a',
        textMuted: '#475569',
        accent: '#0284c7',
        accent2: '#6366f1',
      },
      typography: { fontSans: 'Inter', fontHeading: 'Inter', scale: 'default' },
      layout: { radius: '16px', maxWidth: '1080px', density: 'comfortable' },
      effects: { animations: true, glassmorphism: false },
    },
  },
  {
    name: 'Minimal',
    slug: 'minimal',
    isPreset: true,
    tokens: {
      mode: 'light',
      colors: {
        bg: '#ffffff',
        bgSoft: '#fafafa',
        card: '#ffffff',
        border: '#e4e4e7',
        text: '#18181b',
        textMuted: '#52525b',
        accent: '#18181b',
        accent2: '#52525b',
      },
      typography: { fontSans: 'Inter', fontHeading: 'Inter', scale: 'default' },
      layout: { radius: '8px', maxWidth: '900px', density: 'spacious' },
      effects: { animations: false, glassmorphism: false },
    },
  },
  {
    name: 'Elegant',
    slug: 'elegant',
    isPreset: true,
    tokens: {
      mode: 'dark',
      colors: {
        bg: '#1a1814',
        bgSoft: '#221f1a',
        card: '#28241d',
        border: '#3a342a',
        text: '#f0ebe0',
        textMuted: '#b8ae9c',
        accent: '#c8a04e',
        accent2: '#e0c084',
      },
      typography: { fontSans: 'Georgia', fontHeading: 'Georgia', scale: 'default' },
      layout: { radius: '12px', maxWidth: '1000px', density: 'comfortable' },
      effects: { animations: true, glassmorphism: false },
    },
  },
  {
    name: 'Corporate',
    slug: 'corporate',
    isPreset: true,
    tokens: {
      mode: 'light',
      colors: {
        bg: '#f9fafb',
        bgSoft: '#f3f4f6',
        card: '#ffffff',
        border: '#e5e7eb',
        text: '#111827',
        textMuted: '#4b5563',
        accent: '#1d4ed8',
        accent2: '#1e40af',
      },
      typography: { fontSans: 'Inter', fontHeading: 'Inter', scale: 'default' },
      layout: { radius: '10px', maxWidth: '1100px', density: 'comfortable' },
      effects: { animations: true, glassmorphism: false },
    },
  },
];

function tagsForSkillCategory(name: string): string[] {
  // Heurística simple: mapea categorías a tags para el filtrado de perfiles curados.
  const map: Record<string, string[]> = {
    Lenguajes: [
      'java',
      'dotnet',
      'nodejs',
      'nestjs',
      'fullstack',
      'ai-engineer',
      'python',
      'microsoft',
    ],
    'Backend Frameworks': [
      'java',
      'spring-boot',
      'nestjs',
      'nodejs',
      'dotnet',
      'fullstack',
      'microsoft',
      'ai-engineer',
    ],
    Frontend: ['fullstack', 'nodejs', 'nestjs', 'ai-engineer'],
    Arquitectura: [
      'java',
      'spring-boot',
      'microservices',
      'leadership',
      'integration',
      'event-driven',
      'fullstack',
      'dotnet',
      'ai-engineer',
    ],
    'Mensajería & Eventos': ['java', 'microservices', 'event-driven', 'messaging', 'integration'],
    'Bases de Datos': [
      'java',
      'dotnet',
      'fullstack',
      'banking',
      'integration',
      'microsoft',
      'ai-engineer',
    ],
    'Cloud & DevOps': ['devops', 'cloud', 'iac', 'serverless', 'java', 'azure', 'microsoft'],
    Observabilidad: ['devops', 'cloud', 'microservices', 'azure'],
    Seguridad: ['java', 'fintech', 'banking', 'integration', 'devops', 'ai-engineer'],
    Testing: ['java', 'spring-boot', 'testing', 'qa', 'ai-engineer'],
    'IA & Herramientas Modernas': [
      'ai',
      'ai-engineer',
      'java',
      'leadership',
      'fullstack',
      'nodejs',
      'nestjs',
    ],
    Metodologías: ['leadership', 'management', 'devops'],
  };
  return map[name] ?? [];
}

async function main() {
  console.log('🌱 Iniciando seed...');

  const dataPath = path.resolve(__dirname, '../../docs/cv-data.json');
  const raw = fs.readFileSync(dataPath, 'utf-8');
  const data = JSON.parse(raw) as CvData;

  // ── Limpieza (orden respetando FKs) ──
  console.log('🧹 Limpiando tablas...');
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
  console.log('👤 Creando perfil base...');
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

  // ── Experiences (orden cronológico inverso por índice del array) ──
  console.log(`💼 Creando ${data.experiences.length} experiencias...`);
  for (let i = 0; i < data.experiences.length; i++) {
    const e = data.experiences[i];
    await prisma.experience.create({
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
        visible: true,
      },
    });
  }

  // ── Skill categories + skills ──
  console.log(`🛠️  Creando ${data.skillCategories.length} categorías de skills...`);
  for (let i = 0; i < data.skillCategories.length; i++) {
    const cat = data.skillCategories[i];
    const catTags = tagsForSkillCategory(cat.name.es);
    await prisma.skillCategory.create({
      data: {
        name: cat.name,
        order: i,
        skills: {
          create: cat.skills.map((s, j) => ({ name: s, tags: catTags, order: j })),
        },
      },
    });
  }

  // ── Education ──
  console.log(`🎓 Creando ${data.education.length} registros de educación...`);
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
      },
    });
  }

  // ── Certifications ──
  console.log(`📜 Creando ${data.certifications.length} certificaciones...`);
  for (let i = 0; i < data.certifications.length; i++) {
    const c = data.certifications[i];
    await prisma.certification.create({
      data: { name: c.name, issuer: c.issuer, year: c.year, order: i },
    });
  }

  // ── Projects ──
  console.log(`🚀 Creando ${data.projects.length} proyectos...`);
  for (let i = 0; i < data.projects.length; i++) {
    const pr = data.projects[i];
    await prisma.project.create({
      data: {
        name: pr.name,
        role: pr.role,
        period: pr.period,
        summary: pr.summary,
        technologies: pr.technologies,
        tags: pr.tags,
        url: pr.url,
        order: i,
        visible: pr.visible,
      },
    });
  }

  // ── Social links (GitHub, YouTube, etc.) ──
  const links = data.profile.socialLinks ?? [];
  console.log(`🔗 Creando ${links.length} enlaces sociales...`);
  for (let i = 0; i < links.length; i++) {
    const l = links[i];
    await prisma.socialLink.create({
      data: {
        platform: l.platform,
        handle: l.handle,
        url: l.url,
        label: l.label,
        description: l.description ?? undefined,
        stats: l.stats ?? undefined,
        featured: l.featured,
        visible: l.visible,
        order: i,
      },
    });
  }

  // ── Featured repositories (curaduría manual) ──
  const repos = (data.profile.featuredRepositories ?? []).filter((r) => r.visible);
  console.log(`📦 Creando ${repos.length} repositorios destacados...`);
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
  console.log(`🎨 Creando ${THEME_PRESETS.length} temas preset...`);
  const themeBySlug: Record<string, string> = {};
  for (const t of THEME_PRESETS) {
    const created = await prisma.theme.create({
      data: { name: t.name, slug: t.slug, isPreset: t.isPreset, tokens: t.tokens },
    });
    themeBySlug[t.slug] = created.id;
  }

  // ── Curated profiles (desde profileTemplates) ──
  console.log(`⭐ Creando ${data.profileTemplates.length} perfiles curados...`);
  for (const tpl of data.profileTemplates) {
    await prisma.curatedProfile.create({
      data: {
        slug: tpl.slug,
        title: tpl.title,
        headline: tpl.headline,
        description: tpl.description,
        filterTags: tpl.filterTags,
        roleType: tpl.roleType ?? undefined,
        techFocus: tpl.techFocus ?? undefined,
        accentColor: tpl.accentColor,
        themeId: themeBySlug['modern-dark'],
        layout: 'classic',
        sectionsOrder: [
          'hero',
          'stats',
          'experience',
          'skills',
          'education',
          'certifications',
          'contact',
        ],
        visibility: 'PUBLIC',
      },
    });
  }

  // Perfil curado "all" (vista completa pública)
  await prisma.curatedProfile.create({
    data: {
      slug: 'all',
      title: { es: 'Perfil Completo', en: 'Full Profile' },
      headline: data.profile.headline,
      description: {
        es: 'Vista completa del portafolio profesional.',
        en: 'Complete view of the professional portfolio.',
      },
      filterTags: [], // vacío = mostrar todo
      accentColor: '#38bdf8',
      themeId: themeBySlug['modern-dark'],
      layout: 'classic',
      sectionsOrder: [
        'hero',
        'stats',
        'experience',
        'skills',
        'education',
        'certifications',
        'contact',
      ],
      visibility: 'PUBLIC',
    },
  });

  console.log('✅ Seed completado con éxito.');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

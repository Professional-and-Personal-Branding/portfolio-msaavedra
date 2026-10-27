/**
 * Datos fijos del seed: los presets de tema y la heurística de tags por categoría de skills.
 * Viven aparte para que el runner, el verificador y los tests los compartan.
 */

// ── Presets de tema iniciales (alineados a demo-theming.html) ────
export const THEME_PRESETS = [
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

export function tagsForSkillCategory(name: string): string[] {
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

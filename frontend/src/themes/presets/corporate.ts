import type { ThemePreset } from './types';

export const corporate: ThemePreset = {
  slug: 'corporate',
  name: 'Corporate',
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
};

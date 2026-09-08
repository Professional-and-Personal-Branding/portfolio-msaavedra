import type { ThemePreset } from './types';

export const modernLight: ThemePreset = {
  slug: 'modern-light',
  name: 'Modern Light',
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
};

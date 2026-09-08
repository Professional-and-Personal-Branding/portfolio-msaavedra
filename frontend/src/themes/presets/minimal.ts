import type { ThemePreset } from './types';

export const minimal: ThemePreset = {
  slug: 'minimal',
  name: 'Minimal',
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
};

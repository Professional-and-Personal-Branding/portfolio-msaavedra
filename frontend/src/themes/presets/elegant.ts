import type { ThemePreset } from './types';

export const elegant: ThemePreset = {
  slug: 'elegant',
  name: 'Elegant',
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
};

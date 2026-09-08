import { createContext } from 'react';
import type { ThemePreset } from './presets';
import type { ThemeTokens } from './tokens';

export type ThemeSource = 'preset' | 'profile' | 'default';

export interface ThemeContextValue {
  /** Tokens efectivos (siempre completos). */
  tokens: ThemeTokens;
  /** Preset elegido por el visitante, si lo hay. */
  preset: ThemePreset | null;
  source: ThemeSource;
  /** `effects.animations` y sin `prefers-reduced-motion`. */
  animationsEnabled: boolean;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

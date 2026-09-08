import type { ThemeTokens } from '../tokens';

export interface ThemePreset {
  slug: string;
  name: string;
  tokens: ThemeTokens;
}

import { ThemeTokens } from '../../domain/entities/theme.entity';

/** Tema tal como lo consume el customizador del backoffice. */
export interface ThemeOutput {
  id: string;
  slug: string;
  name: string;
  isPreset: boolean;
  tokens: ThemeTokens;
}

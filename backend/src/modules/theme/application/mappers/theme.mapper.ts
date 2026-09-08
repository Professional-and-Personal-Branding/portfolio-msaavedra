import { Theme } from '../../domain/entities/theme.entity';
import { ThemeOutput } from '../dto/theme.output';

export function toThemeOutput(theme: Theme): ThemeOutput {
  return {
    id: theme.id,
    slug: theme.slug,
    name: theme.name,
    isPreset: theme.isPreset,
    tokens: theme.tokens,
  };
}

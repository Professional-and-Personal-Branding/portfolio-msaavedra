import { Theme } from '../entities/theme.entity';

export const THEME_REPOSITORY = Symbol('ThemeRepository');

/** Preset usado cuando un perfil curado no referencia tema (o el referenciado no existe). */
export const DEFAULT_THEME_SLUG = 'modern-dark';

export interface ThemeRepository {
  findById(id: string): Promise<Theme | null>;
  findBySlug(slug: string): Promise<Theme | null>;
}

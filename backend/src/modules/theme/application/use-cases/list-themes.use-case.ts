import { Inject, Injectable } from '@nestjs/common';
import { ok, Ok } from '../../../../shared/domain/result';
import { THEME_REPOSITORY, ThemeRepository } from '../../domain/repositories/theme.repository';
import { ThemeOutput } from '../dto/theme.output';
import { toThemeOutput } from '../mappers/theme.mapper';

/** Catálogo de temas para el backoffice (spec `admin-theme-catalog`). No puede fallar. */
@Injectable()
export class ListThemesUseCase {
  constructor(@Inject(THEME_REPOSITORY) private readonly themes: ThemeRepository) {}

  async execute(): Promise<Ok<ThemeOutput[]>> {
    const themes = await this.themes.findAll();
    return ok(themes.map(toThemeOutput));
  }
}

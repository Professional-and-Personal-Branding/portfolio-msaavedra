import { Module } from '@nestjs/common';
import { ListThemesUseCase } from './application/use-cases/list-themes.use-case';
import { THEME_REPOSITORY } from './domain/repositories/theme.repository';
import { AdminThemeController } from './infrastructure/controllers/admin-theme.controller';
import { PrismaThemeRepository } from './infrastructure/persistence/prisma-theme.repository';

/**
 * Puerto de lectura de temas para la resolución de perfiles curados (Fase 2) y
 * catálogo para el customizador del backoffice (Fase 5, spec `admin-theme-catalog`).
 */
@Module({
  controllers: [AdminThemeController],
  providers: [{ provide: THEME_REPOSITORY, useClass: PrismaThemeRepository }, ListThemesUseCase],
  exports: [THEME_REPOSITORY],
})
export class ThemeModule {}

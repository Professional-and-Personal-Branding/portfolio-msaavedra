import { Module } from '@nestjs/common';
import { THEME_REPOSITORY } from './domain/repositories/theme.repository';
import { PrismaThemeRepository } from './infrastructure/persistence/prisma-theme.repository';

/** Módulo mínimo (Fase 2): puerto de lectura de temas para la resolución de perfiles curados. */
@Module({
  providers: [{ provide: THEME_REPOSITORY, useClass: PrismaThemeRepository }],
  exports: [THEME_REPOSITORY],
})
export class ThemeModule {}

import { Module } from '@nestjs/common';
import { SKILL_CATEGORY_REPOSITORY } from './domain/repositories/skill-category.repository';
import { PrismaSkillCategoryRepository } from './infrastructure/persistence/prisma-skill-category.repository';

/**
 * Módulo mínimo (Fase 2): solo el puerto de lectura para alimentar la resolución de
 * perfiles curados. Los endpoints y el CRUD llegan en fases posteriores.
 */
@Module({
  providers: [{ provide: SKILL_CATEGORY_REPOSITORY, useClass: PrismaSkillCategoryRepository }],
  exports: [SKILL_CATEGORY_REPOSITORY],
})
export class SkillModule {}

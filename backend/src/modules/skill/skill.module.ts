import { Module } from '@nestjs/common';
import {
  CreateSkillCategoryUseCase,
  CreateSkillUseCase,
  DeleteSkillCategoryUseCase,
  DeleteSkillUseCase,
  ListSkillCategoriesAdminUseCase,
  UpdateSkillCategoryUseCase,
  UpdateSkillUseCase,
} from './application/use-cases/admin/skill-admin.use-cases';
import { SKILL_CATEGORY_REPOSITORY } from './domain/repositories/skill-category.repository';
import { AdminSkillController } from './infrastructure/controllers/admin-skill.controller';
import { PrismaSkillCategoryRepository } from './infrastructure/persistence/prisma-skill-category.repository';

/** Puerto de lectura (perfiles curados) + CRUD del backoffice (Fase 3). */
@Module({
  controllers: [AdminSkillController],
  providers: [
    { provide: SKILL_CATEGORY_REPOSITORY, useClass: PrismaSkillCategoryRepository },
    ListSkillCategoriesAdminUseCase,
    CreateSkillCategoryUseCase,
    UpdateSkillCategoryUseCase,
    DeleteSkillCategoryUseCase,
    CreateSkillUseCase,
    UpdateSkillUseCase,
    DeleteSkillUseCase,
  ],
  exports: [SKILL_CATEGORY_REPOSITORY],
})
export class SkillModule {}

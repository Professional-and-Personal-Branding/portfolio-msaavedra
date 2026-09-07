import { Module } from '@nestjs/common';
import {
  CreateExperienceUseCase,
  DeleteExperienceUseCase,
  GetExperienceAdminUseCase,
  ListAllExperiencesUseCase,
  UpdateExperienceUseCase,
} from './application/use-cases/admin/experience-admin.use-cases';
import { GetExperienceByIdUseCase } from './application/use-cases/get-experience-by-id.use-case';
import { ListExperiencesUseCase } from './application/use-cases/list-experiences.use-case';
import { EXPERIENCE_REPOSITORY } from './domain/repositories/experience.repository';
import { AdminExperienceController } from './infrastructure/controllers/admin-experience.controller';
import { ExperienceController } from './infrastructure/controllers/experience.controller';
import { PrismaExperienceRepository } from './infrastructure/persistence/prisma-experience.repository';

/** Cableado del módulo: el puerto (token) se resuelve con el adaptador Prisma. */
@Module({
  controllers: [ExperienceController, AdminExperienceController],
  providers: [
    { provide: EXPERIENCE_REPOSITORY, useClass: PrismaExperienceRepository },
    ListExperiencesUseCase,
    GetExperienceByIdUseCase,
    ListAllExperiencesUseCase,
    GetExperienceAdminUseCase,
    CreateExperienceUseCase,
    UpdateExperienceUseCase,
    DeleteExperienceUseCase,
  ],
  exports: [ListExperiencesUseCase, GetExperienceByIdUseCase, EXPERIENCE_REPOSITORY],
})
export class ExperienceModule {}

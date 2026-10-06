import { Module } from '@nestjs/common';
import {
  CreateProjectUseCase,
  DeleteProjectUseCase,
  GetProjectAdminUseCase,
  ListAllProjectsUseCase,
  UpdateProjectUseCase,
} from './application/use-cases/admin/project-admin.use-cases';
import { ListProjectsUseCase } from './application/use-cases/list-projects.use-case';
import { PROJECT_REPOSITORY } from './domain/repositories/project.repository';
import { AdminProjectController } from './infrastructure/controllers/admin-project.controller';
import { ProjectController } from './infrastructure/controllers/project.controller';
import { PrismaProjectRepository } from './infrastructure/persistence/prisma-project.repository';

/**
 * Proyectos destacados: lectura pública, puerto para la resolución curada
 * (filtrado por tags) y administración desde el backoffice.
 */
@Module({
  controllers: [ProjectController, AdminProjectController],
  providers: [
    { provide: PROJECT_REPOSITORY, useClass: PrismaProjectRepository },
    ListProjectsUseCase,
    ListAllProjectsUseCase,
    GetProjectAdminUseCase,
    CreateProjectUseCase,
    UpdateProjectUseCase,
    DeleteProjectUseCase,
  ],
  exports: [PROJECT_REPOSITORY],
})
export class ProjectModule {}

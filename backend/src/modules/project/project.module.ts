import { Module } from '@nestjs/common';
import { ListProjectsUseCase } from './application/use-cases/list-projects.use-case';
import { PROJECT_REPOSITORY } from './domain/repositories/project.repository';
import { ProjectController } from './infrastructure/controllers/project.controller';
import { PrismaProjectRepository } from './infrastructure/persistence/prisma-project.repository';

/** Proyectos destacados: lectura pública + puerto para la resolución curada (filtrado por tags). */
@Module({
  controllers: [ProjectController],
  providers: [
    { provide: PROJECT_REPOSITORY, useClass: PrismaProjectRepository },
    ListProjectsUseCase,
  ],
  exports: [PROJECT_REPOSITORY],
})
export class ProjectModule {}

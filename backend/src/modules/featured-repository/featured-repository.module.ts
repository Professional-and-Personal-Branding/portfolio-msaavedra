import { Module } from '@nestjs/common';
import {
  CreateFeaturedRepositoryUseCase,
  DeleteFeaturedRepositoryUseCase,
  GetFeaturedRepositoryAdminUseCase,
  ListAllFeaturedRepositoriesUseCase,
  UpdateFeaturedRepositoryUseCase,
} from './application/use-cases/admin/featured-repository-admin.use-cases';
import { ListFeaturedRepositoriesUseCase } from './application/use-cases/list-featured-repositories.use-case';
import { FEATURED_REPOSITORY_REPOSITORY } from './domain/repositories/featured-repository.repository';
import { AdminFeaturedRepositoryController } from './infrastructure/controllers/admin-featured-repository.controller';
import { FeaturedRepositoryController } from './infrastructure/controllers/featured-repository.controller';
import { PrismaFeaturedRepositoryRepository } from './infrastructure/persistence/prisma-featured-repository.repository';

/**
 * Repositorios destacados de GitHub: lectura pública, puerto para la resolución curada
 * (filtrado por tags) y administración desde el backoffice. Sin sincronización con GitHub.
 */
@Module({
  controllers: [FeaturedRepositoryController, AdminFeaturedRepositoryController],
  providers: [
    { provide: FEATURED_REPOSITORY_REPOSITORY, useClass: PrismaFeaturedRepositoryRepository },
    ListFeaturedRepositoriesUseCase,
    ListAllFeaturedRepositoriesUseCase,
    GetFeaturedRepositoryAdminUseCase,
    CreateFeaturedRepositoryUseCase,
    UpdateFeaturedRepositoryUseCase,
    DeleteFeaturedRepositoryUseCase,
  ],
  exports: [FEATURED_REPOSITORY_REPOSITORY],
})
export class FeaturedRepositoryModule {}

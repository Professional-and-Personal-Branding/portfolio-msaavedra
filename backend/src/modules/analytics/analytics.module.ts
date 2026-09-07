import { Module } from '@nestjs/common';
import { AggregateProfileViewsUseCase } from './application/use-cases/aggregate-profile-views.use-case';
import { PROFILE_VIEW_REPOSITORY } from './domain/repositories/profile-view.repository';
import { AdminAnalyticsController } from './infrastructure/controllers/admin-analytics.controller';
import { PrismaProfileViewRepository } from './infrastructure/persistence/prisma-profile-view.repository';

/** Registro de visitas (lo consume curated-profile) y lectura agregada para el backoffice. */
@Module({
  controllers: [AdminAnalyticsController],
  providers: [
    { provide: PROFILE_VIEW_REPOSITORY, useClass: PrismaProfileViewRepository },
    AggregateProfileViewsUseCase,
  ],
  exports: [PROFILE_VIEW_REPOSITORY],
})
export class AnalyticsModule {}

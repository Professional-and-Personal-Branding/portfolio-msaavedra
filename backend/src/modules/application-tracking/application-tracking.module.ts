import { Module } from '@nestjs/common';
import { CLOCK, systemClock } from '../../shared/domain/clock';
import { AnalyticsModule } from '../analytics/analytics.module';
import {
  CreateApplicationUseCase,
  DeleteApplicationUseCase,
  ExportApplicationsUseCase,
  GetApplicationSummaryUseCase,
  GetApplicationUseCase,
  ListApplicationsUseCase,
  UpdateApplicationUseCase,
} from './application/use-cases/application.use-cases';
import { APPLICATION_REFERENCE_READER } from './domain/repositories/application-reference.reader';
import { APPLICATION_REPOSITORY } from './domain/repositories/application.repository';
import { AdminApplicationController } from './infrastructure/controllers/admin-application.controller';
import { PrismaApplicationReferenceReader } from './infrastructure/persistence/prisma-application-reference.reader';
import { PrismaApplicationRepository } from './infrastructure/persistence/prisma-application.repository';

/**
 * CRM personal de postulaciones (change `add-application-tracking`): solo panel, sin rutas
 * públicas. Importa `AnalyticsModule` para las aperturas de los enlaces (token
 * `PROFILE_VIEW_REPOSITORY`), como ya hace `curated-profile`.
 */
@Module({
  imports: [AnalyticsModule],
  controllers: [AdminApplicationController],
  providers: [
    { provide: APPLICATION_REPOSITORY, useClass: PrismaApplicationRepository },
    { provide: APPLICATION_REFERENCE_READER, useClass: PrismaApplicationReferenceReader },
    { provide: CLOCK, useValue: systemClock },
    ListApplicationsUseCase,
    GetApplicationUseCase,
    CreateApplicationUseCase,
    UpdateApplicationUseCase,
    DeleteApplicationUseCase,
    GetApplicationSummaryUseCase,
    ExportApplicationsUseCase,
  ],
})
export class ApplicationTrackingModule {}

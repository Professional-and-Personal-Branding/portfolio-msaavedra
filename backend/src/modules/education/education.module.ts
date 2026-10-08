import { Module } from '@nestjs/common';
import {
  CreateCertificationUseCase,
  CreateEducationUseCase,
  DeleteCertificationUseCase,
  DeleteEducationUseCase,
  GetCertificationAdminUseCase,
  GetEducationAdminUseCase,
  ListAllCertificationsUseCase,
  ListAllEducationUseCase,
  UpdateCertificationUseCase,
  UpdateEducationUseCase,
} from './application/use-cases/admin/education-admin.use-cases';
import {
  ListCertificationsUseCase,
  ListEducationUseCase,
} from './application/use-cases/education.use-cases';
import {
  CERTIFICATION_REPOSITORY,
  EDUCATION_REPOSITORY,
} from './domain/repositories/education.repository';
import { AdminCertificationController } from './infrastructure/controllers/admin-certification.controller';
import { AdminEducationController } from './infrastructure/controllers/admin-education.controller';
import { EducationController } from './infrastructure/controllers/education.controller';
import {
  PrismaCertificationRepository,
  PrismaEducationRepository,
} from './infrastructure/persistence/prisma-education.repository';

/**
 * Formación y certificaciones: lectura pública, puertos para la resolución
 * curada y administración desde el backoffice.
 */
@Module({
  controllers: [EducationController, AdminEducationController, AdminCertificationController],
  providers: [
    { provide: EDUCATION_REPOSITORY, useClass: PrismaEducationRepository },
    { provide: CERTIFICATION_REPOSITORY, useClass: PrismaCertificationRepository },
    ListEducationUseCase,
    ListCertificationsUseCase,
    ListAllEducationUseCase,
    GetEducationAdminUseCase,
    CreateEducationUseCase,
    UpdateEducationUseCase,
    DeleteEducationUseCase,
    ListAllCertificationsUseCase,
    GetCertificationAdminUseCase,
    CreateCertificationUseCase,
    UpdateCertificationUseCase,
    DeleteCertificationUseCase,
  ],
  exports: [EDUCATION_REPOSITORY, CERTIFICATION_REPOSITORY],
})
export class EducationModule {}

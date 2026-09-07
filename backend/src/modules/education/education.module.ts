import { Module } from '@nestjs/common';
import {
  ListCertificationsUseCase,
  ListEducationUseCase,
} from './application/use-cases/education.use-cases';
import {
  CERTIFICATION_REPOSITORY,
  EDUCATION_REPOSITORY,
} from './domain/repositories/education.repository';
import { EducationController } from './infrastructure/controllers/education.controller';
import {
  PrismaCertificationRepository,
  PrismaEducationRepository,
} from './infrastructure/persistence/prisma-education.repository';

/** Formación y certificaciones: lectura pública + puertos para la resolución curada. */
@Module({
  controllers: [EducationController],
  providers: [
    { provide: EDUCATION_REPOSITORY, useClass: PrismaEducationRepository },
    { provide: CERTIFICATION_REPOSITORY, useClass: PrismaCertificationRepository },
    ListEducationUseCase,
    ListCertificationsUseCase,
  ],
  exports: [EDUCATION_REPOSITORY, CERTIFICATION_REPOSITORY],
})
export class EducationModule {}

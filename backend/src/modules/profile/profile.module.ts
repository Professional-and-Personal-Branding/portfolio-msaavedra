import { Module } from '@nestjs/common';
import {
  CreateLanguageUseCase,
  DeleteLanguageUseCase,
  GetLanguageAdminUseCase,
  ListAllLanguagesUseCase,
  UpdateLanguageUseCase,
} from './application/use-cases/admin/language-admin.use-cases';
import {
  GetProfileAdminUseCase,
  PreviewProfileUseCase,
  ReplaceProfileUseCase,
} from './application/use-cases/admin/profile-admin.use-cases';
import { GetProfileUseCase } from './application/use-cases/get-profile.use-case';
import { LANGUAGE_REPOSITORY, PROFILE_REPOSITORY } from './domain/repositories/profile.repository';
import { AdminLanguageController } from './infrastructure/controllers/admin-language.controller';
import { AdminProfileController } from './infrastructure/controllers/admin-profile.controller';
import { ProfileController } from './infrastructure/controllers/profile.controller';
import {
  PrismaLanguageRepository,
  PrismaProfileRepository,
} from './infrastructure/persistence/prisma-profile.repository';

/**
 * Cableado del módulo: el puerto (token) se resuelve con el adaptador Prisma.
 * Para cambiar de persistencia basta reemplazar `useClass`.
 */
@Module({
  controllers: [ProfileController, AdminProfileController, AdminLanguageController],
  providers: [
    { provide: PROFILE_REPOSITORY, useClass: PrismaProfileRepository },
    { provide: LANGUAGE_REPOSITORY, useClass: PrismaLanguageRepository },
    GetProfileUseCase,
    GetProfileAdminUseCase,
    ReplaceProfileUseCase,
    PreviewProfileUseCase,
    ListAllLanguagesUseCase,
    GetLanguageAdminUseCase,
    CreateLanguageUseCase,
    UpdateLanguageUseCase,
    DeleteLanguageUseCase,
  ],
  exports: [GetProfileUseCase, PROFILE_REPOSITORY],
})
export class ProfileModule {}

import { Module } from '@nestjs/common';
import { GetProfileUseCase } from './application/use-cases/get-profile.use-case';
import { PROFILE_REPOSITORY } from './domain/repositories/profile.repository';
import { ProfileController } from './infrastructure/controllers/profile.controller';
import { PrismaProfileRepository } from './infrastructure/persistence/prisma-profile.repository';

/**
 * Cableado del módulo: el puerto (token) se resuelve con el adaptador Prisma.
 * Para cambiar de persistencia basta reemplazar `useClass`.
 */
@Module({
  controllers: [ProfileController],
  providers: [
    { provide: PROFILE_REPOSITORY, useClass: PrismaProfileRepository },
    GetProfileUseCase,
  ],
  exports: [GetProfileUseCase, PROFILE_REPOSITORY],
})
export class ProfileModule {}

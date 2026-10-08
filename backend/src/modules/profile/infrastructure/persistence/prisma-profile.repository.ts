import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import { Language, NewLanguageProps } from '../../domain/entities/language.entity';
import { Profile } from '../../domain/entities/profile.entity';
import {
  LanguageRepository,
  ProfileRepository,
} from '../../domain/repositories/profile.repository';
import {
  toLanguageData,
  toLanguageEntity,
  toProfileData,
  toProfileEntity,
} from './profile.prisma-mapper';

function isNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

/** Adaptador Prisma del puerto ProfileRepository. */
@Injectable()
export class PrismaProfileRepository implements ProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(): Promise<Profile | null> {
    const record = await this.prisma.profile.findFirst({
      include: { languages: true },
      orderBy: { createdAt: 'asc' },
    });
    return record ? toProfileEntity(record) : null;
  }

  async save(profile: Profile): Promise<Profile | null> {
    try {
      const record = await this.prisma.profile.update({
        where: { id: profile.id },
        data: toProfileData(profile.content()),
        include: { languages: true },
      });
      return toProfileEntity(record);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }
}

/** Adaptador Prisma del puerto LanguageRepository. */
@Injectable()
export class PrismaLanguageRepository implements LanguageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Language[]> {
    // Sin columna de orden: el id (cuid) sigue el orden de creación.
    const records = await this.prisma.language.findMany({ orderBy: { id: 'asc' } });
    return records.map(toLanguageEntity);
  }

  async findById(id: string): Promise<Language | null> {
    const record = await this.prisma.language.findUnique({ where: { id } });
    return record ? toLanguageEntity(record) : null;
  }

  async create(profileId: string, props: NewLanguageProps): Promise<Language> {
    const record = await this.prisma.language.create({
      data: { ...toLanguageData(props), profileId },
    });
    return toLanguageEntity(record);
  }

  async update(language: Language): Promise<Language | null> {
    try {
      const record = await this.prisma.language.update({
        where: { id: language.id },
        data: toLanguageData(language.toProps()),
      });
      return toLanguageEntity(record);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.language.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }
}

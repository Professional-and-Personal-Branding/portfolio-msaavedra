import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import {
  CuratedProfile,
  NewCuratedProfileProps,
} from '../../domain/entities/curated-profile.entity';
import { CuratedProfileRepository } from '../../domain/repositories/curated-profile.repository';
import { toCuratedProfileData, toCuratedProfileEntity } from './curated-profile.prisma-mapper';

function isNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

@Injectable()
export class PrismaCuratedProfileRepository implements CuratedProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBySlug(slug: string): Promise<CuratedProfile | null> {
    const record = await this.prisma.curatedProfile.findUnique({ where: { slug } });
    return record ? toCuratedProfileEntity(record) : null;
  }

  async findAllPublic(): Promise<CuratedProfile[]> {
    const records = await this.prisma.curatedProfile.findMany({
      where: { visibility: 'PUBLIC' },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toCuratedProfileEntity);
  }

  async findAll(): Promise<CuratedProfile[]> {
    const records = await this.prisma.curatedProfile.findMany({ orderBy: { createdAt: 'asc' } });
    return records.map(toCuratedProfileEntity);
  }

  async findById(id: string): Promise<CuratedProfile | null> {
    const record = await this.prisma.curatedProfile.findUnique({ where: { id } });
    return record ? toCuratedProfileEntity(record) : null;
  }

  async existsBySlug(slug: string, excludeId?: string): Promise<boolean> {
    const found = await this.prisma.curatedProfile.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    return found !== null;
  }

  async create(props: NewCuratedProfileProps): Promise<CuratedProfile> {
    const record = await this.prisma.curatedProfile.create({ data: toCuratedProfileData(props) });
    return toCuratedProfileEntity(record);
  }

  async update(profile: CuratedProfile): Promise<CuratedProfile | null> {
    try {
      const record = await this.prisma.curatedProfile.update({
        where: { id: profile.id },
        data: toCuratedProfileData(profile.toProps()),
      });
      return toCuratedProfileEntity(record);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.curatedProfile.delete({ where: { id } }); // ProfileView: onDelete Cascade
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }
}

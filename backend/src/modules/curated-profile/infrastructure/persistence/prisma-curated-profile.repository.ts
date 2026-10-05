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

  async findBySlugOrAlias(slug: string): Promise<CuratedProfile | null> {
    const direct = await this.findBySlug(slug);
    if (direct) return direct;
    const alias = await this.prisma.curatedProfileSlugAlias.findUnique({
      where: { slug },
      include: { curatedProfile: true },
    });
    return alias ? toCuratedProfileEntity(alias.curatedProfile) : null;
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
    const other = excludeId ? { not: excludeId } : undefined;
    const [profile, alias] = await Promise.all([
      this.prisma.curatedProfile.findFirst({
        where: { slug, ...(other ? { id: other } : {}) },
        select: { id: true },
      }),
      this.prisma.curatedProfileSlugAlias.findFirst({
        where: { slug, ...(other ? { curatedProfileId: other } : {}) },
        select: { id: true },
      }),
    ]);
    return profile !== null || alias !== null;
  }

  async create(props: NewCuratedProfileProps): Promise<CuratedProfile> {
    const record = await this.prisma.curatedProfile.create({ data: toCuratedProfileData(props) });
    return toCuratedProfileEntity(record);
  }

  async update(profile: CuratedProfile): Promise<CuratedProfile | null> {
    try {
      const record = await this.prisma.$transaction(async (tx) => {
        const current = await tx.curatedProfile.findUniqueOrThrow({
          where: { id: profile.id },
          select: { slug: true },
        });
        if (current.slug !== profile.slug) {
          // El slug nuevo deja de ser alias (si este perfil vuelve a uno anterior)
          // y el anterior pasa a serlo, para que los links ya enviados sigan vivos.
          await tx.curatedProfileSlugAlias.deleteMany({
            where: { slug: profile.slug, curatedProfileId: profile.id },
          });
          await tx.curatedProfileSlugAlias.create({
            data: { slug: current.slug, curatedProfileId: profile.id },
          });
        }
        return tx.curatedProfile.update({
          where: { id: profile.id },
          data: toCuratedProfileData(profile.toProps()),
        });
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

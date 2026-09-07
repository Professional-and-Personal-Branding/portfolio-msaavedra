import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import { Experience, NewExperienceProps } from '../../domain/entities/experience.entity';
import { ExperienceRepository } from '../../domain/repositories/experience.repository';
import { toExperienceData, toExperienceEntity } from './experience.prisma-mapper';

const CANONICAL_ORDER: Prisma.ExperienceOrderByWithRelationInput[] = [
  { startDate: 'desc' },
  { order: 'asc' },
];

function isNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

/** Adaptador Prisma del puerto ExperienceRepository. */
@Injectable()
export class PrismaExperienceRepository implements ExperienceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllVisible(): Promise<Experience[]> {
    const records = await this.prisma.experience.findMany({
      where: { visible: true },
      orderBy: CANONICAL_ORDER,
    });
    return records.map(toExperienceEntity);
  }

  async findVisibleById(id: string): Promise<Experience | null> {
    const record = await this.prisma.experience.findFirst({ where: { id, visible: true } });
    return record ? toExperienceEntity(record) : null;
  }

  async findAll(): Promise<Experience[]> {
    const records = await this.prisma.experience.findMany({ orderBy: CANONICAL_ORDER });
    return records.map(toExperienceEntity);
  }

  async findById(id: string): Promise<Experience | null> {
    const record = await this.prisma.experience.findUnique({ where: { id } });
    return record ? toExperienceEntity(record) : null;
  }

  async create(props: NewExperienceProps): Promise<Experience> {
    const record = await this.prisma.experience.create({ data: toExperienceData(props) });
    return toExperienceEntity(record);
  }

  async update(experience: Experience): Promise<Experience | null> {
    try {
      const record = await this.prisma.experience.update({
        where: { id: experience.id },
        data: toExperienceData(experience.toProps()),
      });
      return toExperienceEntity(record);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.experience.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import { Experience } from '../../domain/entities/experience.entity';
import { ExperienceRepository } from '../../domain/repositories/experience.repository';
import { toExperienceEntity } from './experience.prisma-mapper';

/** Adaptador Prisma del puerto ExperienceRepository. */
@Injectable()
export class PrismaExperienceRepository implements ExperienceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllVisible(): Promise<Experience[]> {
    const records = await this.prisma.experience.findMany({
      where: { visible: true },
      orderBy: [{ order: 'asc' }, { startDate: 'desc' }],
    });
    return records.map(toExperienceEntity);
  }

  async findVisibleById(id: string): Promise<Experience | null> {
    const record = await this.prisma.experience.findFirst({ where: { id, visible: true } });
    return record ? toExperienceEntity(record) : null;
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import { SkillCategory } from '../../domain/entities/skill-category.entity';
import { SkillCategoryRepository } from '../../domain/repositories/skill-category.repository';
import { toSkillCategoryEntity } from './skill-category.prisma-mapper';

@Injectable()
export class PrismaSkillCategoryRepository implements SkillCategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<SkillCategory[]> {
    const records = await this.prisma.skillCategory.findMany({
      include: { skills: { orderBy: { order: 'asc' } } },
      orderBy: { order: 'asc' },
    });
    return records.map(toSkillCategoryEntity);
  }
}

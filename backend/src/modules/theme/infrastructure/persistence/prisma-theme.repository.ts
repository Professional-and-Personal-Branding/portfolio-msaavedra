import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import { Theme } from '../../domain/entities/theme.entity';
import { ThemeRepository } from '../../domain/repositories/theme.repository';
import { toThemeEntity } from './theme.prisma-mapper';

@Injectable()
export class PrismaThemeRepository implements ThemeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Theme | null> {
    const record = await this.prisma.theme.findUnique({ where: { id } });
    return record ? toThemeEntity(record) : null;
  }

  async findBySlug(slug: string): Promise<Theme | null> {
    const record = await this.prisma.theme.findUnique({ where: { slug } });
    return record ? toThemeEntity(record) : null;
  }

  async findAll(): Promise<Theme[]> {
    const records = await this.prisma.theme.findMany({
      orderBy: [{ isPreset: 'desc' }, { name: 'asc' }],
    });
    return records.map(toThemeEntity);
  }
}

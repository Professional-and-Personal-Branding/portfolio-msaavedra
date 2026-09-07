import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import { Project } from '../../domain/entities/project.entity';
import { ProjectRepository } from '../../domain/repositories/project.repository';
import { toProjectEntity } from './project.prisma-mapper';

@Injectable()
export class PrismaProjectRepository implements ProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllVisible(): Promise<Project[]> {
    const records = await this.prisma.project.findMany({
      where: { visible: true },
      orderBy: { order: 'asc' },
    });
    return records.map(toProjectEntity);
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import { NewProjectProps, Project } from '../../domain/entities/project.entity';
import { ProjectRepository } from '../../domain/repositories/project.repository';
import { toProjectData, toProjectEntity } from './project.prisma-mapper';

function isNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

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

  async findAll(): Promise<Project[]> {
    const records = await this.prisma.project.findMany({ orderBy: { order: 'asc' } });
    return records.map(toProjectEntity);
  }

  async findById(id: string): Promise<Project | null> {
    const record = await this.prisma.project.findUnique({ where: { id } });
    return record ? toProjectEntity(record) : null;
  }

  async create(props: NewProjectProps): Promise<Project> {
    const record = await this.prisma.project.create({ data: toProjectData(props) });
    return toProjectEntity(record);
  }

  async update(project: Project): Promise<Project | null> {
    try {
      const record = await this.prisma.project.update({
        where: { id: project.id },
        data: toProjectData(project.toProps()),
      });
      return toProjectEntity(record);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.project.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }
}

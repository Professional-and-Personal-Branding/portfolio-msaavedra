import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import {
  FeaturedRepository,
  NewFeaturedRepositoryProps,
} from '../../domain/entities/featured-repository.entity';
import { FeaturedRepositoryRepository } from '../../domain/repositories/featured-repository.repository';
import {
  toFeaturedRepositoryData,
  toFeaturedRepositoryEntity,
} from './featured-repository.prisma-mapper';

function isNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

@Injectable()
export class PrismaFeaturedRepositoryRepository implements FeaturedRepositoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllVisible(): Promise<FeaturedRepository[]> {
    const records = await this.prisma.featuredRepository.findMany({
      where: { visible: true },
      orderBy: { order: 'asc' },
    });
    return records.map(toFeaturedRepositoryEntity);
  }

  async findAll(): Promise<FeaturedRepository[]> {
    const records = await this.prisma.featuredRepository.findMany({ orderBy: { order: 'asc' } });
    return records.map(toFeaturedRepositoryEntity);
  }

  async findById(id: string): Promise<FeaturedRepository | null> {
    const record = await this.prisma.featuredRepository.findUnique({ where: { id } });
    return record ? toFeaturedRepositoryEntity(record) : null;
  }

  async create(props: NewFeaturedRepositoryProps): Promise<FeaturedRepository> {
    const record = await this.prisma.featuredRepository.create({
      data: toFeaturedRepositoryData(props),
    });
    return toFeaturedRepositoryEntity(record);
  }

  async update(repository: FeaturedRepository): Promise<FeaturedRepository | null> {
    try {
      const record = await this.prisma.featuredRepository.update({
        where: { id: repository.id },
        data: toFeaturedRepositoryData(repository.toProps()),
      });
      return toFeaturedRepositoryEntity(record);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.featuredRepository.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import { CuratedProfile } from '../../domain/entities/curated-profile.entity';
import { CuratedProfileRepository } from '../../domain/repositories/curated-profile.repository';
import { toCuratedProfileEntity } from './curated-profile.prisma-mapper';

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
}

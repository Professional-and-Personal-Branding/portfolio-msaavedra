import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import { Profile } from '../../domain/entities/profile.entity';
import { ProfileRepository } from '../../domain/repositories/profile.repository';
import { toProfileEntity } from './profile.prisma-mapper';

/** Adaptador Prisma del puerto ProfileRepository. */
@Injectable()
export class PrismaProfileRepository implements ProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(): Promise<Profile | null> {
    const record = await this.prisma.profile.findFirst({
      include: { languages: true },
      orderBy: { createdAt: 'asc' },
    });
    return record ? toProfileEntity(record) : null;
  }
}

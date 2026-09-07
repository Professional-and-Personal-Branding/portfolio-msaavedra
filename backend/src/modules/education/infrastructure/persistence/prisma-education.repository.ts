import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import { Certification } from '../../domain/entities/certification.entity';
import { Education } from '../../domain/entities/education.entity';
import {
  CertificationRepository,
  EducationRepository,
} from '../../domain/repositories/education.repository';
import { toCertificationEntity, toEducationEntity } from './education.prisma-mapper';

@Injectable()
export class PrismaEducationRepository implements EducationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllVisible(): Promise<Education[]> {
    const records = await this.prisma.education.findMany({
      where: { visible: true },
      orderBy: { order: 'asc' },
    });
    return records.map(toEducationEntity);
  }
}

@Injectable()
export class PrismaCertificationRepository implements CertificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllVisible(): Promise<Certification[]> {
    const records = await this.prisma.certification.findMany({
      where: { visible: true },
      orderBy: { order: 'asc' },
    });
    return records.map(toCertificationEntity);
  }
}

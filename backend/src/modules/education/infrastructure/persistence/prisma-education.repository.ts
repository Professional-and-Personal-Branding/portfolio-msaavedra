import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import { Certification, NewCertificationProps } from '../../domain/entities/certification.entity';
import { Education, NewEducationProps } from '../../domain/entities/education.entity';
import {
  CertificationRepository,
  EducationRepository,
} from '../../domain/repositories/education.repository';
import {
  toCertificationData,
  toCertificationEntity,
  toEducationData,
  toEducationEntity,
} from './education.prisma-mapper';

function isNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

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

  async findAll(): Promise<Education[]> {
    const records = await this.prisma.education.findMany({ orderBy: { order: 'asc' } });
    return records.map(toEducationEntity);
  }

  async findById(id: string): Promise<Education | null> {
    const record = await this.prisma.education.findUnique({ where: { id } });
    return record ? toEducationEntity(record) : null;
  }

  async create(props: NewEducationProps): Promise<Education> {
    const record = await this.prisma.education.create({ data: toEducationData(props) });
    return toEducationEntity(record);
  }

  async update(education: Education): Promise<Education | null> {
    try {
      const record = await this.prisma.education.update({
        where: { id: education.id },
        data: toEducationData(education.toProps()),
      });
      return toEducationEntity(record);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.education.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
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

  async findAll(): Promise<Certification[]> {
    const records = await this.prisma.certification.findMany({ orderBy: { order: 'asc' } });
    return records.map(toCertificationEntity);
  }

  async findById(id: string): Promise<Certification | null> {
    const record = await this.prisma.certification.findUnique({ where: { id } });
    return record ? toCertificationEntity(record) : null;
  }

  async create(props: NewCertificationProps): Promise<Certification> {
    const record = await this.prisma.certification.create({ data: toCertificationData(props) });
    return toCertificationEntity(record);
  }

  async update(certification: Certification): Promise<Certification | null> {
    try {
      const record = await this.prisma.certification.update({
        where: { id: certification.id },
        data: toCertificationData(certification.toProps()),
      });
      return toCertificationEntity(record);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.certification.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }
}

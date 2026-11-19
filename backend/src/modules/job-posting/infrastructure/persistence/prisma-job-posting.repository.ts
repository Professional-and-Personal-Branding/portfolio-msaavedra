import { Injectable } from '@nestjs/common';
import { JobPosting as JobPostingRow, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import { JobPosting, NewJobPosting } from '../../domain/entities/job-posting.entity';
import {
  JobPostingRepository,
  UpsertJobPostingResult,
} from '../../domain/repositories/job-posting.repository';

function toDomain(row: JobPostingRow): JobPosting {
  return {
    id: row.id,
    source: row.source,
    sourceKey: row.sourceKey,
    sourceUrl: row.sourceUrl,
    applyUrl: row.applyUrl,
    title: row.title,
    company: row.company,
    location: row.location,
    workplaceType: row.workplaceType,
    employmentType: row.employmentType,
    compensation: row.compensation,
    language: row.language,
    postedAt: row.postedAt,
    description: row.description,
    descriptionTruncated: row.descriptionTruncated,
    detectedTerms: row.detectedTerms,
    importedAt: row.importedAt,
    textPurgeAt: row.textPurgeAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toData(data: NewJobPosting): Prisma.JobPostingUncheckedCreateInput {
  return { ...data, detectedTerms: [...data.detectedTerms] };
}

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const isNotFound = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';

@Injectable()
export class PrismaJobPostingRepository implements JobPostingRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Una fila por `sourceKey`. Dos importaciones simultáneas de la misma vacante pueden chocar en
   * la creación (P2002): se reintenta una vez, y esa segunda pasada la encuentra y la actualiza.
   */
  async upsertBySourceKey(data: NewJobPosting): Promise<UpsertJobPostingResult> {
    for (let attempt = 0; ; attempt += 1) {
      const existing = await this.prisma.jobPosting.findUnique({
        where: { sourceKey: data.sourceKey },
        select: { id: true },
      });
      try {
        if (existing) {
          const row = await this.prisma.jobPosting.update({
            where: { id: existing.id },
            data: toData(data),
          });
          return { posting: toDomain(row), created: false };
        }
        const row = await this.prisma.jobPosting.create({ data: toData(data) });
        return { posting: toDomain(row), created: true };
      } catch (error) {
        if (attempt === 0 && isUniqueViolation(error)) continue;
        throw error;
      }
    }
  }

  async list(): Promise<JobPosting[]> {
    const rows = await this.prisma.jobPosting.findMany({
      orderBy: [{ importedAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<JobPosting | null> {
    const row = await this.prisma.jobPosting.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.jobPosting.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }

  /** Un único `UPDATE ... WHERE textPurgeAt <= now AND description IS NOT NULL` (D13). */
  async purgeExpiredText(now: Date): Promise<number> {
    const result = await this.prisma.jobPosting.updateMany({
      where: { textPurgeAt: { lte: now }, description: { not: null } },
      data: { description: null, descriptionTruncated: false },
    });
    return result.count;
  }

  /** Mismo filtro que `purgeExpiredText`, solo lectura. */
  countExpiredText(now: Date): Promise<number> {
    return this.prisma.jobPosting.count({
      where: { textPurgeAt: { lte: now }, description: { not: null } },
    });
  }
}

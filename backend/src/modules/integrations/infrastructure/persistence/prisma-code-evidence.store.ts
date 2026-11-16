import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import {
  CodeEvidenceStore,
  EvidenceTarget,
} from '../../application/github/code-evidence-store.port';
import { GITHUB_PROVIDER } from '../../application/github/sync-github-evidence.service';
import { RepositoryEvidence } from '../../../featured-repository/domain/value-objects/repository-evidence';

/** Violación de clave foránea: el repositorio destacado se borró mientras corría la sincronización. */
const FOREIGN_KEY_VIOLATION = 'P2003';

function toLanguages(value: unknown): Record<string, number> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, number] => typeof entry[1] === 'number',
  );
  return Object.fromEntries(entries);
}

/**
 * Único camino de ESCRITURA de `RepositoryEvidence` (change `add-github-code-evidence`, D2: lo
 * verifica `test/architecture.spec.ts`). `featured-repository` solo la lee.
 */
@Injectable()
export class PrismaCodeEvidenceStore implements CodeEvidenceStore {
  constructor(private readonly prisma: PrismaService) {}

  async listTargets(): Promise<EvidenceTarget[]> {
    const rows = await this.prisma.featuredRepository.findMany({
      select: { id: true, url: true, order: true, visible: true },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => ({
      featuredRepositoryId: row.id,
      url: row.url,
      order: row.order,
      visible: row.visible,
    }));
  }

  async find(featuredRepositoryId: string): Promise<RepositoryEvidence | null> {
    const row = await this.prisma.repositoryEvidence.findUnique({
      where: { featuredRepositoryId },
    });
    if (!row) return null;
    return {
      repoKey: row.repoKey,
      status: row.status,
      stars: row.stars,
      primaryLanguage: row.primaryLanguage,
      languages: toLanguages(row.languages),
      topics: row.topics,
      pushedAt: row.pushedAt,
      archived: row.archived,
      isFork: row.isFork,
      movedTo: row.movedTo,
      githubDescription: row.githubDescription,
      verifiedAt: row.verifiedAt,
      changedAt: row.changedAt,
    };
  }

  async save(featuredRepositoryId: string, evidence: RepositoryEvidence): Promise<boolean> {
    const data = {
      repoKey: evidence.repoKey,
      status: evidence.status,
      stars: evidence.stars,
      primaryLanguage: evidence.primaryLanguage,
      languages: evidence.languages ?? Prisma.DbNull,
      topics: [...evidence.topics],
      pushedAt: evidence.pushedAt,
      archived: evidence.archived,
      isFork: evidence.isFork,
      movedTo: evidence.movedTo,
      githubDescription: evidence.githubDescription,
      verifiedAt: evidence.verifiedAt,
      changedAt: evidence.changedAt,
    };
    try {
      await this.prisma.repositoryEvidence.upsert({
        where: { featuredRepositoryId },
        create: { featuredRepositoryId, ...data },
        update: data,
      });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === FOREIGN_KEY_VIOLATION
      ) {
        return false;
      }
      throw error;
    }
  }

  async pruneSnapshots(keepResourceKeys: readonly string[]): Promise<void> {
    await this.prisma.externalSnapshot.deleteMany({
      where: { provider: GITHUB_PROVIDER, resourceKey: { notIn: [...keepResourceKeys] } },
    });
  }
}

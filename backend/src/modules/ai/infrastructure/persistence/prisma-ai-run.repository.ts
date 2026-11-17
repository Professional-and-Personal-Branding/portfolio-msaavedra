import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import { AiRunRepository } from '../../application/ports/ai-repositories';
import { AiRun } from '../../domain/ai-run.entity';
import { toCreateData, toDomain } from './ai-run.mapper';

/** Corridas de IA en Postgres. Solo `modules/ai` escribe esta tabla (D15). */
@Injectable()
export class PrismaAiRunRepository implements AiRunRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(run: AiRun): Promise<void> {
    await this.prisma.aiRun.create({ data: toCreateData(run) });
  }

  async findSucceededByCacheKey(cacheKey: string): Promise<AiRun | null> {
    const row = await this.prisma.aiRun.findFirst({
      where: { cacheKey, status: 'SUCCEEDED' },
      orderBy: { createdAt: 'desc' },
    });
    return row ? toDomain(row) : null;
  }

  async findById(id: string): Promise<AiRun | null> {
    const row = await this.prisma.aiRun.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async listRecent(limit: number): Promise<AiRun[]> {
    const rows = await this.prisma.aiRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(toDomain);
  }
}

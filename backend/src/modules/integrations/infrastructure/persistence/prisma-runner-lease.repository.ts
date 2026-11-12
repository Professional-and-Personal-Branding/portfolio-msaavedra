import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import { RunnerLeaseRepository } from '../../domain/repositories/runner-lease.repository';

/**
 * Arriendo del ejecutor en una sola fila (D4). Usa el reloj de Postgres (`now()`) y una
 * conexión unos milisegundos por consulta: no retiene ninguna del pool mientras corre el trabajo.
 * Las columnas `timestamp(3)` se guardan en UTC, por eso se compara con `now() AT TIME ZONE 'UTC'`.
 */
@Injectable()
export class PrismaRunnerLeaseRepository implements RunnerLeaseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async acquire(holder: string, ttlMs: number): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ holder: string }>>`
      UPDATE "IntegrationRunnerLease"
         SET holder = ${holder},
             "expiresAt" = (now() AT TIME ZONE 'UTC') + (${ttlMs}::double precision / 1000) * interval '1 second'
       WHERE id = 'runner'
         AND ("expiresAt" < (now() AT TIME ZONE 'UTC') OR holder = ${holder})
      RETURNING holder`;
    return rows.length > 0;
  }

  async release(holder: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "IntegrationRunnerLease"
         SET "expiresAt" = (now() AT TIME ZONE 'UTC')
       WHERE id = 'runner' AND holder = ${holder}`;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/persistence/prisma.service';

export type CheckStatus = 'up' | 'down';

export interface HealthReport {
  status: 'ok' | 'error';
  uptime: number;
  checks: { database: { status: CheckStatus; responseTime?: number } };
}

/** Tiempo máximo que se espera a la base antes de declararla caída. */
export const DATABASE_TIMEOUT_MS = 2000;

/**
 * Comprobación de salud (spec `api-health`). Consulta trivial: nunca lee datos
 * del portafolio y nunca devuelve el mensaje del driver, que puede contener la
 * cadena de conexión.
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthReport> {
    const startedAt = Date.now();
    const alive = await this.pingDatabase();
    const responseTime = Date.now() - startedAt;

    return {
      status: alive ? 'ok' : 'error',
      uptime: Math.round(process.uptime()),
      checks: { database: { status: alive ? 'up' : 'down', responseTime } },
    };
  }

  private async pingDatabase(): Promise<boolean> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), DATABASE_TIMEOUT_MS).unref?.(),
    );

    try {
      await Promise.race([this.prisma.$queryRaw`SELECT 1`, timeout]);
      return true;
    } catch (error) {
      // El detalle va al log; hacia afuera solo se dice que está caída.
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`La base no respondió al healthcheck: ${message}`);
      return false;
    }
  }
}

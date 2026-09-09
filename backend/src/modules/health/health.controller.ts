import { Controller, Get, HttpCode, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { HealthService, type HealthReport } from './health.service';

/**
 * Sondas para el orquestador (spec `api-health`). Van fuera del prefijo `/api`
 * y sin autenticación; el `exclude` de `setGlobalPrefix` en `main.ts` las deja
 * en `/health`. No aparecen en Swagger: no son API de producto.
 */
@ApiExcludeController()
// El orquestador consulta cada pocos segundos: nunca debe recibir 429.
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthReport> {
    const report = await this.health.check();
    // 503 para que el orquestador saque la instancia del balanceador.
    res.status(report.status === 'ok' ? 200 : 503);
    return report;
  }

  /** Vive aunque la base no: evita reinicios por una caída temporal de Postgres. */
  @Get('live')
  @HttpCode(200)
  live(): { status: 'ok'; uptime: number } {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }
}

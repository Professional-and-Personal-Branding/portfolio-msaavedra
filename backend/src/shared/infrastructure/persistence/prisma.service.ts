import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { BACKGROUND_TASKS, BackgroundTasks } from '../../application/background-tasks';

/** Tope de espera a las tareas en vuelo al apagar (antes de desconectar la base). */
export const SHUTDOWN_DRAIN_MS = 5000;

/**
 * Único punto de acceso a Prisma. Solo puede importarse desde
 * `infrastructure/persistence/*` de cada módulo (regla de dependencia).
 * Conecta al arrancar: si la base no responde, el arranque falla (fail-fast).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(@Inject(BACKGROUND_TASKS) private readonly background: BackgroundTasks) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conexión a PostgreSQL establecida');
  }

  /**
   * Las visitas en vuelo se escriben con esta conexión: se drenan antes de
   * desconectar. Es el único punto con orden garantizado (design D5).
   */
  async onModuleDestroy(): Promise<void> {
    await this.background.drain(SHUTDOWN_DRAIN_MS);
    await this.$disconnect();
  }
}

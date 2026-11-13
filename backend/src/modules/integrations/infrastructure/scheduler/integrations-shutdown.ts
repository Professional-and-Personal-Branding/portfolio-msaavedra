import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { IntegrationsScheduler, ShutdownSignal } from './integrations-scheduler';

/**
 * Apagado ordenado (D6): detiene los timers y aborta la señal del trabajo en curso. La corrida
 * está registrada en `BackgroundTasks`, que `PrismaService` drena antes de desconectar: termina
 * de escribir (devuelve el trabajo a `PENDING` y libera el arriendo) con la base todavía abierta.
 */
@Injectable()
export class IntegrationsShutdown implements OnModuleDestroy {
  constructor(
    private readonly scheduler: IntegrationsScheduler,
    private readonly shutdown: ShutdownSignal,
  ) {}

  onModuleDestroy(): void {
    this.scheduler.stopTimers();
    this.shutdown.abort();
  }
}

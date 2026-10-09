import { Injectable, Logger } from '@nestjs/common';
import { BackgroundTasks } from '../../application/background-tasks';

/** Tareas en el mismo proceso: suficiente para escrituras cortas como el registro de visitas. */
@Injectable()
export class InProcessBackgroundTasks implements BackgroundTasks {
  private readonly logger = new Logger(InProcessBackgroundTasks.name);
  private readonly inFlight = new Set<Promise<void>>();

  run(name: string, task: () => Promise<void>): void {
    let started: Promise<void>;
    try {
      started = task();
    } catch (error) {
      started = Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
    const tracked: Promise<void> = started
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Falló la tarea en segundo plano "${name}": ${message}`);
      })
      .finally(() => {
        this.inFlight.delete(tracked);
      });
    this.inFlight.add(tracked);
  }

  async whenIdle(): Promise<void> {
    while (this.inFlight.size > 0) {
      await Promise.all([...this.inFlight]);
    }
  }

  async drain(timeoutMs: number): Promise<void> {
    if (this.inFlight.size === 0) return;
    let timer: NodeJS.Timeout | undefined;
    let timedOut = false;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(() => {
        timedOut = true;
        resolve();
      }, timeoutMs);
    });
    await Promise.race([this.whenIdle(), timeout]);
    clearTimeout(timer);
    if (timedOut && this.inFlight.size > 0) {
      this.logger.warn(
        `El drenaje venció a los ${timeoutMs} ms con ${this.inFlight.size} tarea(s) pendiente(s)`,
      );
    }
  }
}

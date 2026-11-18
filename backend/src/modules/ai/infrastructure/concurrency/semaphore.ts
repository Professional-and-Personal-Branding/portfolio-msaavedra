import { ConcurrencyLimiter } from '../../application/ports/ai-support.ports';

interface Waiter {
  resolve: (release: (() => void) | null) => void;
  timer: NodeJS.Timeout;
}

/**
 * Semáforo por proceso (D14): `limit` llamadas simultáneas. Si no hay lugar en `maxWaitMs`
 * devuelve `null` en vez de seguir esperando: la petición responde 503 y no se encola.
 */
export class Semaphore implements ConcurrencyLimiter {
  private active = 0;
  private readonly waiters: Waiter[] = [];

  constructor(private readonly limit: number) {}

  acquire(maxWaitMs: number): Promise<(() => void) | null> {
    if (this.active < this.limit) {
      this.active += 1;
      return Promise.resolve(this.releaser());
    }
    return new Promise((resolve) => {
      const waiter: Waiter = {
        resolve,
        timer: setTimeout(() => {
          const index = this.waiters.indexOf(waiter);
          if (index >= 0) this.waiters.splice(index, 1);
          resolve(null);
        }, maxWaitMs),
      };
      this.waiters.push(waiter);
    });
  }

  /** Libera el lugar una sola vez (llamarlo de nuevo no hace nada). */
  private releaser(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.waiters.shift();
      if (next) {
        clearTimeout(next.timer);
        next.resolve(this.releaser());
      } else {
        this.active -= 1;
      }
    };
  }
}

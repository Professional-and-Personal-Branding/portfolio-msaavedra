/**
 * Puerto de tareas en segundo plano: trabajo que no debe retrasar la respuesta
 * (p. ej. registrar una visita). Sin Nest ni Prisma: lo implementa infraestructura.
 */
export interface BackgroundTasks {
  /**
   * Lanza la tarea y la registra como en vuelo. No espera. Un rechazo se
   * captura y se registra en el log con `name`; nunca se propaga.
   */
  run(name: string, task: () => Promise<void>): void;
  /** Resuelve cuando no queda ninguna tarea en vuelo, incluidas las lanzadas mientras se esperaba. */
  whenIdle(): Promise<void>;
  /** Como `whenIdle`, con tope: al vencer registra un aviso con la cantidad pendiente y resuelve. */
  drain(timeoutMs: number): Promise<void>;
}

export const BACKGROUND_TASKS = Symbol('BACKGROUND_TASKS');

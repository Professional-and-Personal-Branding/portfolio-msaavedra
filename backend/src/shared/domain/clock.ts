/**
 * Hora del sistema como puerto, para que un caso de uso que registra una fecha
 * (archivar un perfil) sea determinista en los tests.
 */
export const CLOCK = Symbol('Clock');

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

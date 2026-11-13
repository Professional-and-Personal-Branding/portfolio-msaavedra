const BASE_MS = 30_000;
const CAP_MS = 6 * 60 * 60 * 1000;
const MIN_MS = 1000;

/**
 * Espera antes del reintento `attempt` (empieza en 1), en milisegundos: jitter completo,
 * `random() * min(6 h, 30 s * 2^(attempt - 1))`, con un mínimo de 1 s (D8). `random` es
 * inyectable para tests deterministas.
 */
export function nextRetryDelay(attempt: number, random: () => number = Math.random): number {
  const exponent = Math.min(Math.max(attempt, 1) - 1, 30);
  const ceiling = Math.min(CAP_MS, BASE_MS * 2 ** exponent);
  return Math.max(MIN_MS, Math.floor(random() * ceiling));
}

/** Margen de 1 a 5 s que se suma a la pista del tercero para no llegar todos al mismo instante. */
export function hintMargin(random: () => number = Math.random): number {
  return 1000 + Math.floor(random() * 4000);
}

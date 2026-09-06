import { Experience } from '../entities/experience.entity';

/**
 * Orden canónico de la trayectoria: `order` ascendente y, a igual `order`,
 * `startDate` (YYYY-MM) descendente — la más reciente primero.
 * Función pura: invariante de dominio testeable sin base de datos y reutilizable
 * en Fase 2 tras filtrar por tags. No muta el array de entrada.
 */
export function compareExperiences(a: Experience, b: Experience): number {
  if (a.order !== b.order) return a.order - b.order;
  // YYYY-MM se compara lexicográficamente de forma correcta.
  return b.startDate.localeCompare(a.startDate);
}

export function sortExperiences(experiences: readonly Experience[]): Experience[] {
  return [...experiences].sort(compareExperiences);
}

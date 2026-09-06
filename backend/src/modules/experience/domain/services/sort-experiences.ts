import { Experience } from '../entities/experience.entity';

/**
 * Orden canónico de la trayectoria (decisión D1 de add-curated-profile-resolution):
 * cronológico — `startDate` (YYYY-MM) descendente, la más reciente primero — y, a igual
 * `startDate`, `order` ascendente como desempate controlado por el administrador.
 * Función pura: invariante de dominio testeable sin base de datos, compartida por
 * `GET /api/experiences` y por la resolución de perfiles curados. No muta la entrada.
 */
export function compareExperiences(a: Experience, b: Experience): number {
  // YYYY-MM se compara lexicográficamente de forma correcta.
  const byDate = b.startDate.localeCompare(a.startDate);
  if (byDate !== 0) return byDate;
  return a.order - b.order;
}

export function sortExperiences(experiences: readonly Experience[]): Experience[] {
  return [...experiences].sort(compareExperiences);
}

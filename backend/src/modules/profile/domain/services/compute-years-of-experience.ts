import { YEAR_MONTH_REGEX } from '../../../experience/domain/services/validate-experience';

/** Mes calendario en formato `YYYY-MM`. */
export type YearMonth = string;

/** Tramo de una trayectoria: lo único que el cálculo necesita de una experiencia. */
export interface ExperienceInterval {
  readonly startDate: string;
  readonly endDate: string | null;
  readonly current: boolean;
}

export interface YearsOfExperience {
  /** Meses cubiertos por la unión de los intervalos (cada mes cuenta una sola vez). */
  readonly months: number;
  /** `floor(months / 12)`. */
  readonly years: number;
  /** `months % 12`. */
  readonly remainderMonths: number;
}

/** Índice absoluto de un mes: permite comparar y restar sin `Date`. */
function monthIndex(value: YearMonth): number {
  return Number(value.slice(0, 4)) * 12 + (Number(value.slice(5, 7)) - 1);
}

/**
 * Años de experiencia a partir de intervalos `YYYY-MM` (decisión D2 de
 * `add-cv-consistency-rules`). Función pura y sin dependencias del perfil: sirve para el total
 * y para cualquier subconjunto (por tag, por tecnología).
 *
 * - Un intervalo cubre desde el mes de inicio hasta el de fin, ambos incluidos.
 * - `current` (o sin `endDate`) termina en `asOf`; un fin posterior a `asOf` se recorta.
 * - Se ignoran, sin fallar, los intervalos con fechas inválidas, con fin anterior al inicio o
 *   que empiezan después de `asOf`: eso lo reportan las reglas de fechas.
 * - Los solapados o contiguos se fusionan, así que dos trabajos en paralelo no suman dos veces.
 */
export function computeYearsOfExperience(
  intervals: readonly ExperienceInterval[],
  asOf: YearMonth,
): YearsOfExperience {
  if (!YEAR_MONTH_REGEX.test(asOf)) return { months: 0, years: 0, remainderMonths: 0 };
  const limit = monthIndex(asOf);

  const spans: Array<[number, number]> = [];
  for (const interval of intervals) {
    if (!YEAR_MONTH_REGEX.test(interval.startDate)) continue;
    const ongoing = interval.current || interval.endDate === null;
    if (!ongoing && !YEAR_MONTH_REGEX.test(interval.endDate as string)) continue;
    const start = monthIndex(interval.startDate);
    const end = Math.min(ongoing ? limit : monthIndex(interval.endDate as string), limit);
    if (start > limit || end < start) continue;
    spans.push([start, end]);
  }
  spans.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  let months = 0;
  let open: [number, number] | null = null;
  for (const span of spans) {
    if (open !== null && span[0] <= open[1] + 1) {
      open[1] = Math.max(open[1], span[1]);
      continue;
    }
    if (open !== null) months += open[1] - open[0] + 1;
    open = [span[0], span[1]];
  }
  if (open !== null) months += open[1] - open[0] + 1;

  return { months, years: Math.floor(months / 12), remainderMonths: months % 12 };
}

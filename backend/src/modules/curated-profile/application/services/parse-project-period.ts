/** Fechas de un proyecto en el formato `iso8601` de JSON Resume (`AAAA` o `AAAA-MM`). */
export interface ProjectDates {
  startDate?: string;
  endDate?: string;
}

const DATE = String.raw`[1-2]\d{3}(?:-(?:0[1-9]|1[0-2]))?`;
const SINGLE = new RegExp(`^(${DATE})$`);
const RANGE = new RegExp(String.raw`^(${DATE})\s*[–—-]\s*(.+)$`);

/**
 * `Project.period` es texto libre. Solo se interpreta lo que tiene forma de años: `AAAA`,
 * `AAAA-MM` o un rango de dos de esos separados por `–`, `—` o `-`. Un segundo extremo que no es
 * fecha (`actualidad`, `present`) deja solo `startDate`; cualquier otra forma no emite fechas
 * (D4 de `add-json-resume-export`). Nunca emite una fecha que rompa el patrón.
 */
export function parseProjectPeriod(period: string): ProjectDates {
  const text = period.trim();
  const single = SINGLE.exec(text);
  if (single) return { startDate: single[1] };

  const range = RANGE.exec(text);
  if (!range) return {};
  const end = SINGLE.exec(range[2].trim());
  return end ? { startDate: range[1], endDate: end[1] } : { startDate: range[1] };
}

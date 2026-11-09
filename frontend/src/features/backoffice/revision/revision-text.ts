import { formatCount } from '@/shared/i18n/plural';
import type { CvSeverity } from '../shared/admin-types';

/** «1 error · 2 avisos · 1 sugerencia»: singular cuando el número es 1. */
export function summaryText(summary: Record<CvSeverity, number>): string {
  return [
    formatCount(summary.error, { one: 'error', other: 'errores' }),
    formatCount(summary.warning, { one: 'aviso', other: 'avisos' }),
    formatCount(summary.info, { one: 'sugerencia', other: 'sugerencias' }),
  ].join(' · ');
}

/** «Experiencia: 11 años declarados; las fechas suman 11 años y 11 meses». */
export function experienceText(declaredYears: number, derivedMonths: number): string {
  const years = Math.floor(derivedMonths / 12);
  const months = derivedMonths % 12;
  return (
    `Experiencia: ${formatCount(declaredYears, { one: 'año declarado', other: 'años declarados' })}; ` +
    `las fechas suman ${formatCount(years, { one: 'año', other: 'años' })} y ` +
    `${formatCount(months, { one: 'mes', other: 'meses' })}`
  );
}

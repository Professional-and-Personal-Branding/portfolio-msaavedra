import type { Locale } from '@/shared/i18n/locale';

const INTL_LOCALE: Record<Locale, string> = { es: 'es-ES', en: 'en-US' };

/** `2024-03-01` → `mar 2024` / `Mar 2024`. Fechas inválidas se devuelven tal cual. */
export function formatMonthYear(isoDate: string, locale: Locale): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  const formatted = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
  return formatted.replace('.', '');
}

export function formatPeriod(
  startDate: string,
  endDate: string | null,
  locale: Locale,
  presentLabel: string,
): string {
  const start = formatMonthYear(startDate, locale);
  const end = endDate ? formatMonthYear(endDate, locale) : presentLabel;
  return `${start} — ${end}`;
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

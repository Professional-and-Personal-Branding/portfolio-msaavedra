import type { AiRun, AiUsage, AiUsageState } from '../shared/admin-types';
import { formatDateTime } from './integration-text';

/** Textos literales del bloque de IA (change `add-ai-foundation`, D18): los usa también el manual. */
export const AI_DISABLED_TEXT = 'La IA está apagada. Se enciende con la variable';
export const AI_DISABLED_TEXT_END = 'del servidor.';
export const AI_OK_TEXT = 'Activa';
export const AI_NEAR_LIMIT_TEXT = 'Cerca del tope del mes';
export const AI_EXHAUSTED_TEXT = 'Se alcanzó el tope de IA del mes';
export const AI_NOTICE_TEXT = 'La IA alcanzó el tope del mes';
export const AI_CONFIRM_REAL = 'Hace una llamada real a Anthropic (unos 0,0001 USD).';
export const AI_CONFIRM_FAKE = 'Proveedor de prueba: no llama a Anthropic.';

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

/** `AAAA-MM` → «noviembre de 2026». */
export function monthLabel(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  const name = match ? MONTHS[Number(match[2]) - 1] : undefined;
  return match && name ? `${name} de ${match[1]}` : month;
}

/** `AAAA-MM-DD` → «17 de noviembre de 2026» (sin pasar por la zona horaria). */
export function dayLabel(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  const name = match ? MONTHS[Number(match[2]) - 1] : undefined;
  return match && name ? `${Number(match[3])} de ${name} de ${match[1]}` : isoDate;
}

/** USD con coma decimal y dos decimales: 1.23 → «1,23». */
export function usd2(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

/** Costo de una corrida (micro-USD) en USD, con los decimales que hagan falta (hasta 6). */
export function costLabel(micro: number | null): string {
  if (micro === null) return '—';
  if (micro === 0) return '0';
  const value = (micro / 1_000_000).toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  return `${value.replace('.', ',')} USD`;
}

/** «Gastado 1,23 de 10,00 USD en noviembre de 2026 (12 %)». */
export function spentLine(usage: AiUsage): string {
  return `Gastado ${usd2(usage.spentUsd)} de ${usd2(usage.budgetUsd)} USD en ${monthLabel(usage.month)} (${usage.percentUsed} %)`;
}

/** Texto del estado (siempre como texto; el color solo lo refuerza). `null` para `DISABLED`: lleva su propio párrafo. */
export function stateText(usage: AiUsage): string | null {
  const state: AiUsageState = usage.state;
  switch (state) {
    case 'DISABLED':
      return null;
    case 'OK':
      return AI_OK_TEXT;
    case 'NEAR_LIMIT':
      return AI_NEAR_LIMIT_TEXT;
    case 'EXHAUSTED':
      return AI_EXHAUSTED_TEXT;
    case 'PROVIDER_BLOCKED':
      return `Anthropic cortó por el spend limit hasta ${
        usage.providerBlockedUntil ? formatDateTime(usage.providerBlockedUntil) : 'nuevo aviso'
      }`;
  }
}

export const STATE_TONE: Readonly<Record<AiUsageState, string>> = {
  DISABLED: 'text-text-muted',
  OK: 'text-success-ink',
  NEAR_LIMIT: 'text-brand-2-ink',
  EXHAUSTED: 'text-danger-ink',
  PROVIDER_BLOCKED: 'text-danger-ink',
};

export const RUN_STATUS_LABELS: Readonly<Record<AiRun['status'], string>> = {
  RESERVED: 'En curso',
  SUCCEEDED: 'Exitosa',
  CACHED: 'De caché',
  REFUSED: 'Rechazada',
  FAILED: 'Fallida',
  ABANDONED: 'Abandonada',
  BLOCKED: 'Bloqueada',
};

export function tokensLabel(run: AiRun): string {
  if (run.inputTokens === null && run.outputTokens === null) return '—';
  return `${run.inputTokens ?? 0} / ${run.outputTokens ?? 0}`;
}

export function durationLabel(ms: number | null): string {
  if (ms === null) return '—';
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
}

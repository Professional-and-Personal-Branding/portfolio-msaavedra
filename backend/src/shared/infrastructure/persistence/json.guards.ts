import { Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { LocalizedList, LocalizedText } from '../../domain/i18n';

/**
 * Type-guards para los campos `Json` de Prisma. Un valor con forma inesperada
 * nunca rompe una respuesta pública: se registra un warning y se mapea a vacío.
 */
const logger = new Logger('PrismaJsonMapper');

export function isLocalizedText(value: unknown): value is LocalizedText {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every((v) => typeof v === 'string');
}

export function isLocalizedList(value: unknown): value is LocalizedList {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(
    (v) => Array.isArray(v) && v.every((item) => typeof item === 'string'),
  );
}

export function toLocalizedText(
  value: Prisma.JsonValue | null | undefined,
  field: string,
): LocalizedText | string {
  if (value == null) return {};
  if (typeof value === 'string') return value; // dato plano legacy
  if (isLocalizedText(value)) return value;
  logger.warn(`Campo "${field}" con forma inesperada; se devuelve vacío`);
  return {};
}

export function toLocalizedList(
  value: Prisma.JsonValue | null | undefined,
  field: string,
): LocalizedList | string[] {
  if (value == null) return {};
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
    return value; // lista plana legacy
  }
  if (isLocalizedList(value)) return value;
  logger.warn(`Campo "${field}" con forma inesperada; se devuelve vacío`);
  return {};
}

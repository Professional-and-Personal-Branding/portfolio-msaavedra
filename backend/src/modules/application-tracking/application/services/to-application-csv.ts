import { ApplicationStatus } from '../../domain/application-status';
import { ApplicationOutput } from '../dto/application.output';

/** Etiquetas en español del estado, las mismas del panel. */
export const APPLICATION_STATUS_LABELS: Readonly<Record<ApplicationStatus, string>> = {
  DRAFT: 'Por postular',
  APPLIED: 'Postulada',
  INTERVIEWING: 'En entrevistas',
  OFFER: 'Oferta',
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
  WITHDRAWN: 'Retirada',
};

/** Cabecera del CSV, en el orden de D10. */
export const APPLICATION_CSV_HEADER = [
  'Empresa',
  'Puesto',
  'Estado',
  'Portal',
  'URL de la vacante',
  'Fecha de postulación',
  'Último cambio de estado',
  'Perfil',
  'Enlace',
  'Abierto el',
  'Aperturas',
  'Notas',
  'Creada',
  'Actualizada',
] as const;

const BOM = '﻿';
const EOL = '\r\n';
/** Caracteres con los que una planilla interpretaría la celda como fórmula (OWASP CSV Injection). */
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Una celda lista para el CSV: si empieza con un disparador de fórmula se le antepone un
 * apóstrofo (el dato se conserva visible), se duplican las comillas y se entrecomilla siempre.
 */
export function csvCell(value: string): string {
  const safe = FORMULA_TRIGGERS.some((char) => value.startsWith(char)) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Nombre del archivo con la fecha UTC del reloj: `postulaciones-AAAA-MM-DD.csv`. */
export function applicationCsvFilename(now: Date): string {
  return `postulaciones-${now.toISOString().slice(0, 10)}.csv`;
}

/**
 * CSV de las postulaciones (D10): BOM UTF-8 para que Excel lea los acentos, coma, CRLF y todas
 * las celdas entre comillas. Sin ids ni el código del enlace. Sin filas, solo la cabecera.
 */
export function toApplicationCsv(rows: readonly ApplicationOutput[]): string {
  const lines: string[][] = [
    [...APPLICATION_CSV_HEADER],
    ...rows.map((row) => [
      row.company,
      row.role,
      APPLICATION_STATUS_LABELS[row.status],
      row.portal ?? '',
      row.jobUrl ?? '',
      row.appliedAt ?? '',
      row.statusChangedAt,
      row.profileSlug ?? '',
      row.shareLink?.label ?? '',
      row.shareLink?.firstOpenedAt ?? '',
      row.shareLink ? String(row.shareLink.opens) : '',
      row.notes ?? '',
      row.createdAt,
      row.updatedAt,
    ]),
  ];
  return BOM + lines.map((cells) => cells.map(csvCell).join(',')).join(EOL);
}

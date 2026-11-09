import { API_BASE_URL, HttpError } from '@/shared/lib/api-client';
import { statusQuery } from './application-status';
import type { ApplicationStatus } from '../shared/admin-types';

const FALLBACK_NAME = 'postulaciones.csv';

/** Nombre del archivo según `Content-Disposition: attachment; filename="…"`. */
export function filenameFromDisposition(header: string | null): string {
  const match = header ? /filename="([^"]+)"/.exec(header) : null;
  return match?.[1] ?? FALLBACK_NAME;
}

/** URL del export con el mismo filtro que la lista (los estados van separados por coma). */
export function exportUrl(statuses: readonly ApplicationStatus[] | undefined): string {
  const status = statusQuery(statuses);
  return `${API_BASE_URL}/api/admin/applications/export${status ? `?status=${status}` : ''}`;
}

/**
 * Descarga el CSV con la sesión del panel (D11): un `<a href download>` guardaría el JSON del 401
 * como archivo si la sesión venció. Ante un error HTTP rechaza con `HttpError` sin crear ningún
 * objeto URL ni archivo.
 */
export async function downloadApplicationsCsv(
  statuses: readonly ApplicationStatus[] | undefined,
): Promise<string> {
  const response = await globalThis.fetch(exportUrl(statuses), { credentials: 'include' });
  if (!response.ok) throw new HttpError(response.status, response.statusText);
  const filename = filenameFromDisposition(response.headers.get('Content-Disposition'));
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
  return filename;
}

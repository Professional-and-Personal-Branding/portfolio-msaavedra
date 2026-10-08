/** Origen de una visita sin `referrer` utilizable (spec `profile-view-analytics`, D5). */
export const DIRECT_REFERRER = 'directo';
/** Navegación dentro del propio sitio: no es tráfico entrante. */
export const INTERNAL_REFERRER = 'interno';

/** Host en minúsculas y sin `www.`; null si no es una URL absoluta. */
function hostOf(value: string): string | null {
  try {
    const host = new URL(value).hostname.toLowerCase();
    if (!host) return null;
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return null;
  }
}

/**
 * Reduce un `referrer` guardado a su origen agregable. Se queda solo con el
 * host: el path y la query pueden traer datos que no hacen falta para contar.
 *
 * - nulo, vacío o no parseable → `directo`;
 * - el host del propio sitio (`siteUrl`) → `interno`;
 * - cualquier otra URL → su host, en minúsculas y sin `www.`.
 */
export function normalizeReferrer(
  referrer: string | null | undefined,
  siteUrl: string | null,
): string {
  const host = referrer ? hostOf(referrer.trim()) : null;
  if (!host) return DIRECT_REFERRER;
  const site = siteUrl ? hostOf(siteUrl) : null;
  return host === site ? INTERNAL_REFERRER : host;
}

/**
 * Agrupa conteos por `referrer` crudo en conteos por origen normalizado,
 * ordenados por visitas descendente (y por nombre ante empate). La suma no
 * cambia: cada visita cae en exactamente un origen.
 */
export function aggregateByReferrer(
  rows: readonly { referrer: string | null; views: number }[],
  siteUrl: string | null,
): { referrer: string; views: number }[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const origin = normalizeReferrer(row.referrer, siteUrl);
    totals.set(origin, (totals.get(origin) ?? 0) + row.views);
  }
  return [...totals]
    .map(([referrer, views]) => ({ referrer, views }))
    .sort((a, b) => b.views - a.views || a.referrer.localeCompare(b.referrer));
}

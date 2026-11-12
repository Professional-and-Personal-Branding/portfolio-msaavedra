import { normalizeHost } from './normalize-host';

/** Parámetros de seguimiento que no cambian la vacante (D14), además de `utm_*`. */
const TRACKING_PARAMS = new Set(['gh_src', 'lever-source', 'ref', 'source']);

function isTracking(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.startsWith('utm_') || TRACKING_PARAMS.has(lower);
}

/**
 * URL canónica (D14), pura: sin fragmento, host en minúsculas y sin punto final, sin los
 * parámetros de seguimiento y con el resto ordenado. Es la base del `sourceKey` del JSON-LD:
 * la misma vacante con `?utm_source=x#apply` es la misma fila.
 */
export function canonicalizeUrl(input: URL | string): string {
  const url = new URL(typeof input === 'string' ? input : input.href);
  url.hash = '';
  url.hostname = normalizeHost(url.hostname);

  const kept = [...url.searchParams.entries()]
    .filter(([name]) => !isTracking(name))
    .sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)));
  url.search = '';
  for (const [name, value] of kept) url.searchParams.append(name, value);
  return url.toString();
}

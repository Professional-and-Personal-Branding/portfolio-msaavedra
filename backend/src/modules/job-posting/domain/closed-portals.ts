import { normalizeHost } from './services/normalize-host';

/**
 * Portales cuyos términos no permiten leer sus vacantes (D5): lista versionada en código, con su
 * test de tabla. Se aplica al host de la URL y al de cada redirect, antes de cualquier DNS o
 * petición. El respaldo JSON-LD nunca corre sobre estos hosts.
 */
export interface ClosedPortalRule {
  readonly id: string;
  /** Nombre que ve el owner en el mensaje. */
  readonly label: string;
  readonly pattern: RegExp;
}

const escapeDots = (value: string): string => value.replace(/\./g, '\\.');

/** El dominio exacto o cualquiera de sus subdominios. */
function domains(...hosts: string[]): RegExp {
  return new RegExp(`(^|\\.)(?:${hosts.map(escapeDots).join('|')})$`);
}

/**
 * `<nombre>.<sufijo>` y subdominios, con el sufijo de uno o dos labels (`com`, `com.ar`,
 * `co.uk`): `indeed.com.mx` entra y `misindeedjobs.com` no.
 */
function withCountrySuffix(name: string): RegExp {
  return new RegExp(
    `(^|\\.)${escapeDots(name)}\\.(?:[a-z]{2,}|(?:com|co|org|net|gov|edu|ac)\\.[a-z]{2})$`,
  );
}

export const CLOSED_PORTALS: readonly ClosedPortalRule[] = [
  { id: 'linkedin', label: 'LinkedIn', pattern: domains('linkedin.com', 'lnkd.in') },
  { id: 'indeed', label: 'Indeed', pattern: withCountrySuffix('indeed') },
  { id: 'glassdoor', label: 'Glassdoor', pattern: withCountrySuffix('glassdoor') },
  { id: 'wellfound', label: 'Wellfound', pattern: domains('wellfound.com', 'angel.co') },
  { id: 'computrabajo', label: 'Computrabajo', pattern: withCountrySuffix('computrabajo') },
  { id: 'bumeran', label: 'Bumeran', pattern: withCountrySuffix('bumeran') },
  { id: 'laborum', label: 'Laborum', pattern: withCountrySuffix('laborum') },
  { id: 'zonajobs', label: 'ZonaJobs', pattern: withCountrySuffix('zonajobs') },
  { id: 'workana', label: 'Workana', pattern: domains('workana.com') },
  { id: 'upwork', label: 'Upwork', pattern: domains('upwork.com') },
  { id: 'torre', label: 'Torre', pattern: domains('torre.ai', 'torre.co') },
  { id: 'getonbrd', label: 'Get on Board', pattern: domains('getonbrd.com', 'getonbrd.cl') },
  // Agregadores: cada uno con su nombre (D5, «el nombre del sitio»).
  { id: 'aggregators', label: 'Himalayas', pattern: domains('himalayas.app') },
  { id: 'aggregators', label: 'Remotive', pattern: domains('remotive.com') },
  { id: 'aggregators', label: 'Remote OK', pattern: domains('remoteok.com', 'remoteok.io') },
  { id: 'aggregators', label: 'Adzuna', pattern: withCountrySuffix('adzuna') },
  { id: 'aggregators', label: 'Jooble', pattern: domains('jooble.org') },
  { id: 'aggregators', label: 'Arbeitnow', pattern: domains('arbeitnow.com') },
];

/** La regla del portal cerrado al que pertenece el host, o `null`. */
export function classifyClosedPortal(host: string): ClosedPortalRule | null {
  const normalized = normalizeHost(host);
  return CLOSED_PORTALS.find((rule) => rule.pattern.test(normalized)) ?? null;
}

/** Mensaje de D5: no repite «Pegá el texto» porque ya indica qué hacer. */
export function closedPortalMessage(rule: ClosedPortalRule): string {
  return `«${rule.label}» no permite leer sus vacantes. Copiá el texto de la vacante y pegalo en «Texto».`;
}

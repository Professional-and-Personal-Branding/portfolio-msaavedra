import { fail, ok, Result } from '../../../../shared/domain/result';
import { ImportFailure } from '../errors/import-failure';
import { normalizeHost } from './normalize-host';

/** Forma permitida de `board`, `site`, `org` e `id` antes de armar la URL de la API (D3). */
const SEGMENT = /^[A-Za-z0-9._-]{1,100}$/;

export type AtsMatch =
  | {
      readonly kind: 'GREENHOUSE';
      readonly board: string;
      readonly id: string;
      readonly eu: boolean;
    }
  | { readonly kind: 'LEVER'; readonly site: string; readonly id: string; readonly eu: boolean }
  | { readonly kind: 'ASHBY'; readonly org: string; readonly id: string };

const GREENHOUSE_HOSTS = new Map<string, boolean>([
  ['boards.greenhouse.io', false],
  ['job-boards.greenhouse.io', false],
  ['boards.eu.greenhouse.io', true],
  ['job-boards.eu.greenhouse.io', true],
]);
const LEVER_HOSTS = new Map<string, boolean>([
  ['jobs.lever.co', false],
  ['jobs.eu.lever.co', true],
]);
const ASHBY_HOST = 'jobs.ashbyhq.com';

function invalid(): ImportFailure {
  return ImportFailure.withHint('unparseable', 'No pudimos leer la dirección de esa vacante');
}

function valid(...parts: string[]): boolean {
  return parts.every((part) => SEGMENT.test(part) && part !== '.' && part !== '..');
}

/**
 * Reconoce las URLs de vacante de Greenhouse, Lever y Ashby (D3). `ok(null)` si el host no es
 * de un ATS (cae al respaldo JSON-LD); `fail` si es de un ATS pero un segmento no tiene la forma
 * permitida (un id con `../`, por ejemplo): nunca se arma una URL de API con la entrada cruda.
 */
export function matchAtsUrl(url: URL): Result<AtsMatch | null, ImportFailure> {
  const host = normalizeHost(url.hostname);
  const segments = url.pathname.split('/').filter((segment) => segment !== '');

  if (GREENHOUSE_HOSTS.has(host)) {
    const eu = GREENHOUSE_HOSTS.get(host) ?? false;
    // /{board}/jobs/{id}
    if (segments.length === 3 && segments[1] === 'jobs') {
      const [board, , id] = segments;
      return valid(board, id) ? ok({ kind: 'GREENHOUSE', board, id, eu }) : fail(invalid());
    }
    // /embed/job_app?for={board}&token={id}
    if (segments.length === 2 && segments[0] === 'embed' && segments[1] === 'job_app') {
      const board = url.searchParams.get('for') ?? '';
      const id = url.searchParams.get('token') ?? '';
      return valid(board, id) ? ok({ kind: 'GREENHOUSE', board, id, eu }) : fail(invalid());
    }
    return ok(null);
  }

  if (LEVER_HOSTS.has(host)) {
    const eu = LEVER_HOSTS.get(host) ?? false;
    // /{site}/{id} o /{site}/{id}/apply
    if (segments.length === 2 || (segments.length === 3 && segments[2] === 'apply')) {
      const [site, id] = segments;
      return valid(site, id) ? ok({ kind: 'LEVER', site, id, eu }) : fail(invalid());
    }
    return ok(null);
  }

  if (host === ASHBY_HOST) {
    // /{org}/{id} o /{org}/{id}/application
    if (segments.length === 2 || (segments.length === 3 && segments[2] === 'application')) {
      const [org, id] = segments;
      return valid(org, id) ? ok({ kind: 'ASHBY', org, id }) : fail(invalid());
    }
    return ok(null);
  }

  return ok(null);
}

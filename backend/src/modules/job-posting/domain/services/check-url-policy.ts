import { isIP } from 'node:net';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { ImportFailure } from '../errors/import-failure';
import { normalizeHost } from './normalize-host';

/** Longitud máxima de la URL pedida (D7). */
export const MAX_URL_LENGTH = 2048;

const LOCAL_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.lan',
  '.home.arpa',
  '.test',
  '.example',
  '.invalid',
] as const;

const HTTPS_ONLY_MESSAGE = 'Usá una URL que empiece con https://';

function notAllowed(base: string): ImportFailure {
  return ImportFailure.withHint('url-not-allowed', base);
}

/**
 * Política de la URL, pura y antes de cualquier red (D7). Se parsea con WHATWG `URL`, que ya
 * normaliza `2130706433`, `0x7f.1` y `0177.0.0.1` a la forma decimal con puntos; esa forma es una
 * IP literal y se rechaza. Solo `https:` al puerto 443, sin usuario ni contraseña, host con al
 * menos un punto que no sea local. El fragmento se descarta. La validación de las direcciones a
 * las que resuelve el nombre es otra capa (`SafeHttpClient`, D9).
 */
export function checkUrlPolicy(raw: string): Result<URL, ImportFailure> {
  const text = raw.trim();
  if (text.length > MAX_URL_LENGTH) {
    return fail(notAllowed(`La URL es demasiado larga (máximo ${MAX_URL_LENGTH} caracteres)`));
  }

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return fail(notAllowed('La URL no es válida'));
  }

  if (url.protocol !== 'https:') {
    return fail(new ImportFailure('url-not-allowed', HTTPS_ONLY_MESSAGE));
  }
  if (url.port !== '' && url.port !== '443') {
    return fail(notAllowed('La URL usa un puerto que no está permitido'));
  }
  if (url.username !== '' || url.password !== '') {
    return fail(notAllowed('La URL no puede llevar usuario ni contraseña'));
  }

  const host = normalizeHost(url.hostname.replace(/^\[|\]$/g, ''));
  if (host === '' || isIP(host) !== 0) {
    return fail(notAllowed('La URL no puede ser una dirección IP'));
  }
  if (!host.includes('.') || host === 'localhost') {
    return fail(notAllowed('La URL apunta a un nombre que no está permitido'));
  }
  if (LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return fail(notAllowed('La URL apunta a un nombre que no está permitido'));
  }

  url.hash = '';
  return ok(url);
}

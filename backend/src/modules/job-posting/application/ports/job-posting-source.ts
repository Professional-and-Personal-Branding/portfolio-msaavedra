import { Result } from '../../../../shared/domain/result';
import { JobPostingSourceKind, NormalizedPosting } from '../../domain/entities/job-posting.entity';
import { ImportFailure } from '../../domain/errors/import-failure';

/** Tope de 2 MiB para HTML y de 5 MiB para el JSON de un ATS, después de descomprimir (D9). */
export const MAX_HTML_BYTES = 2 * 1024 * 1024;
export const MAX_JSON_BYTES = 5 * 1024 * 1024;

export interface SafeHttpGetOptions {
  /** `html` espera `text/html` o `application/xhtml+xml`; `json`, `application/json`. */
  readonly accept: 'html' | 'json';
  readonly maxBytes: number;
  /** Plazo de toda la importación (DNS, conexión, redirects y cuerpo). */
  readonly signal: AbortSignal;
}

export interface SafeHttpResponse {
  /** URL final, tras seguir los redirects. */
  readonly url: URL;
  readonly body: string;
}

export const SAFE_HTTP_CLIENT = Symbol('SafeHttpClient');

/**
 * Único camino a la red de la importación (D2, D7–D10): `GET` a una URL que ya pasó la política,
 * con redirects a mano, direcciones validadas al conectar, tope de tamaño y de tiempo. Las fuentes
 * lo reciben por inyección y nunca abren sockets por su cuenta.
 */
export interface SafeHttpClient {
  get(url: URL, options: SafeHttpGetOptions): Promise<Result<SafeHttpResponse, ImportFailure>>;
}

export const JOB_POSTING_SOURCE_LIST = Symbol('JobPostingSources');

/**
 * Una forma de obtener una vacante normalizada desde una URL (D2). Las fuentes se prueban en
 * orden y la primera cuyo `canHandle` dé `true` gana; el respaldo JSON-LD va al final.
 */
export interface JobPostingSource {
  readonly kind: JobPostingSourceKind;
  canHandle(url: URL): boolean;
  fetch(url: URL, signal: AbortSignal): Promise<Result<NormalizedPosting, ImportFailure>>;
}

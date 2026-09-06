/**
 * Result<T, E> — manejo explícito de errores en el dominio (patrón Either).
 * El dominio y los casos de uso devuelven un Result en lugar de lanzar excepciones;
 * la capa HTTP decide cómo traducir cada error.
 */
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Fail<E> = { readonly ok: false; readonly error: E };
export type Result<T, E = Error> = Ok<T> | Fail<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function fail<E>(error: E): Fail<E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

export function isFail<T, E>(result: Result<T, E>): result is Fail<E> {
  return !result.ok;
}

/** Transforma el valor de un Result exitoso; propaga el error sin tocarlo. */
export function mapResult<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

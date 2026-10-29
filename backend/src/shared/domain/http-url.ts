/** URL absoluta http(s): lo único que el sitio puede enlazar sin sorpresas. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** URL absoluta https: la única que se acepta como enlace de verificación de una credencial. */
export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Portal válido: minúsculas, dígitos y guiones, hasta 32 caracteres, sin empezar con guion. */
const SOURCE_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;

/**
 * Normaliza el portal de una visita (`?src=`) o de un enlace (decisión D3 de `add-share-links`):
 * recorta, pasa a minúsculas y exige `^[a-z0-9][a-z0-9-]{0,31}$`; si no cumple, `null`. Es la
 * misma regla para lo que escribe un visitante (se descarta) y para lo que escribe el owner (se
 * rechaza con 400 en `validateNewShareLink`).
 */
export function normalizeSource(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toLowerCase();
  return SOURCE_PATTERN.test(value) ? value : null;
}

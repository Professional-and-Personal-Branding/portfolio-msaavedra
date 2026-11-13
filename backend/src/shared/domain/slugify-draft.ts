const MAX_SLUG_LENGTH = 60;
const FALLBACK_SLUG = 'vacante';

/**
 * Base de slug para un borrador desde una vacante (D12): empresa + puesto, NFKD sin diacríticos,
 * minúsculas, todo lo que no es `[a-z0-9]` pasa a un guion, sin guiones en los extremos y como
 * máximo 60 caracteres (cortando en un guion si cabe). Entrada vacía → `vacante`. Siempre cumple
 * `SLUG_REGEX` de `curated-profile`. Vive en `shared/domain` porque la usan `job-posting`
 * (sugerencia) y `curated-profile` (borrador) sin importarse entre sí (D19).
 */
export function slugifyDraft(company: string | null | undefined, title: string): string {
  const joined = `${company ?? ''} ${title}`
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (joined === '') return FALLBACK_SLUG;
  if (joined.length <= MAX_SLUG_LENGTH) return joined;

  const cut = joined.slice(0, MAX_SLUG_LENGTH);
  // Si el corte cae a mitad de palabra, se vuelve al último guion (si hay uno).
  const atWordEnd = joined[MAX_SLUG_LENGTH] === '-';
  const lastDash = cut.lastIndexOf('-');
  const trimmed = !atWordEnd && lastDash > 0 ? cut.slice(0, lastDash) : cut;
  return trimmed.replace(/-+$/, '') || FALLBACK_SLUG;
}

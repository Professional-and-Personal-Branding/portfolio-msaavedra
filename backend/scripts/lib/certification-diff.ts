/**
 * Comparación de la credencial de cada certificación entre la fuente del seed y la base
 * (`add-certification-verification`, D9). Función pura: la usa `verify-seed.ts` y la prueba
 * `test/seed-verify-certifications.spec.ts`. Las filas se emparejan por orden (`order`), que es el
 * índice en la fuente; las diferencias nombran la certificación y el campo.
 */
import type { SeedCertification } from './seed-source';

export interface CertificationRow {
  verificationUrl: string | null;
  credentialId: string | null;
  expiresAt: string | null;
}

const FIELDS = ['verificationUrl', 'credentialId', 'expiresAt'] as const;

/** Un texto con nombre legible para el informe: el español, o el texto plano. */
function displayName(name: SeedCertification['name']): string {
  if (typeof name === 'string') return name;
  return typeof name.es === 'string' ? name.es : '(sin nombre)';
}

/**
 * `rows` son las certificaciones de la base ordenadas por `order`. Devuelve una línea por campo
 * que difiere (ausente en la fuente = `null`); vacío si todo coincide.
 */
export function certificationCredentialDiffs(
  source: readonly SeedCertification[],
  rows: readonly CertificationRow[],
): string[] {
  const diffs: string[] = [];
  source.forEach((cert, i) => {
    const row = rows[i];
    if (!row) return; // la diferencia de conteo la informa la tabla de conteos
    for (const field of FIELDS) {
      const wanted = cert[field] ?? null;
      if (wanted !== row[field]) {
        diffs.push(
          `certifications[${i}] «${displayName(cert.name)}» ${field}: esperado=${JSON.stringify(wanted)} actual=${JSON.stringify(row[field])}`,
        );
      }
    }
  });
  return diffs;
}

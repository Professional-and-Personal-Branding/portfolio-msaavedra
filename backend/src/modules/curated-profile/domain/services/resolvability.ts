import { CuratedVisibility } from '../entities/curated-profile.entity';

export type Resolvability = 'ok' | 'unauthorized' | 'not-found';

/**
 * La única decisión de si un slug resuelve (spec `curated-profile-resolution`,
 * tabla de verdad). `archivedAt` gana siempre y da `not-found`, nunca
 * `unauthorized`: un 401 confirmaría que el slug existió, que es la misma razón
 * por la que `PRIVATE` responde 404. `listed` no participa: decide la
 * enumeración, no el acceso.
 */
export function resolvability(
  visibility: CuratedVisibility,
  archivedAt: Date | null,
  validToken: boolean,
): Resolvability {
  if (archivedAt !== null) return 'not-found';
  switch (visibility) {
    case 'PUBLIC':
      return 'ok';
    case 'PROTECTED':
      return validToken ? 'ok' : 'unauthorized';
    case 'PRIVATE':
      return 'not-found';
  }
}

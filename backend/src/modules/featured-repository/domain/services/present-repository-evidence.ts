import { RepositoryEvidence } from '../value-objects/repository-evidence';
import { githubRepositoryKeyOf } from './parse-github-repository-url';

/** Tope de lenguajes y de topics en la tarjeta pública (D10). */
export const MAX_PUBLIC_LANGUAGES = 3;
export const MAX_PUBLIC_TOPICS = 5;

export interface PresentedLanguage {
  readonly name: string;
  /** Porcentaje entero por bytes, sin 0 %. */
  readonly percent: number;
}

/** Lo que se publica de la evidencia (D10): nunca el estado crudo ni la descripción de GitHub. */
export interface PresentedRepositoryEvidence {
  readonly stars: number;
  readonly languages: readonly PresentedLanguage[];
  readonly topics: readonly string[];
  readonly pushedAt: string | null;
  readonly archived: boolean;
  readonly verifiedAt: string;
}

/**
 * ¿La evidencia sirve para publicar? Solo con estado `OK` y si su `repoKey` es el de la URL
 * actual del repositorio: un `PATCH` de la URL la invalida hasta la próxima sincronización.
 */
export function isEvidenceValid(
  url: string,
  evidence: RepositoryEvidence | null | undefined,
): evidence is RepositoryEvidence {
  return (
    evidence !== null &&
    evidence !== undefined &&
    evidence.status === 'OK' &&
    evidence.repoKey === githubRepositoryKeyOf(url)
  );
}

/**
 * Lenguaje efectivo (D9): el cargado a mano manda (override explícito); si no hay, el principal
 * verificado en GitHub. Solo se usa evidencia válida: un repo privado o no encontrado no aporta nada.
 */
export function effectiveLanguage(
  repository: { url: string; language: string | null },
  evidence: RepositoryEvidence | null | undefined,
): string | null {
  if (repository.language !== null && repository.language.trim() !== '') {
    return repository.language;
  }
  return isEvidenceValid(repository.url, evidence) ? evidence.primaryLanguage : null;
}

const normalizeTerm = (term: string): string => term.toLowerCase().replace(/[\s\-_.]/g, '');

function presentLanguages(languages: Readonly<Record<string, number>> | null): PresentedLanguage[] {
  if (languages === null) return [];
  const entries = Object.entries(languages).filter(([, bytes]) => bytes > 0);
  const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
  if (total === 0) return [];
  return entries
    .sort(([nameA, bytesA], [nameB, bytesB]) =>
      bytesB !== bytesA ? bytesB - bytesA : nameA < nameB ? -1 : nameA > nameB ? 1 : 0,
    )
    .slice(0, MAX_PUBLIC_LANGUAGES)
    .map(([name, bytes]) => ({ name, percent: Math.round((bytes / total) * 100) }))
    .filter((language) => language.percent > 0);
}

/**
 * Evidencia pública de un repositorio (D10), o `null` si no hay una válida. Los topics que repiten
 * una tecnología cargada a mano no se muestran (se compara sin mayúsculas ni separadores).
 */
export function presentRepositoryEvidence(
  repository: { url: string; technologies: readonly string[] },
  evidence: RepositoryEvidence | null | undefined,
): PresentedRepositoryEvidence | null {
  if (!isEvidenceValid(repository.url, evidence)) return null;
  const known = new Set(repository.technologies.map(normalizeTerm));
  return {
    stars: evidence.stars ?? 0,
    languages: presentLanguages(evidence.languages),
    topics: evidence.topics
      .filter((topic) => !known.has(normalizeTerm(topic)))
      .slice(0, MAX_PUBLIC_TOPICS),
    pushedAt: evidence.pushedAt?.toISOString() ?? null,
    archived: evidence.archived,
    verifiedAt: evidence.verifiedAt.toISOString(),
  };
}

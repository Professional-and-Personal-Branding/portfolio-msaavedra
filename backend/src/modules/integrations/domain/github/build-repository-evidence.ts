import {
  RepositoryEvidence,
  RepositoryEvidenceContent,
  sameEvidenceContent,
} from '../../../featured-repository/domain/value-objects/repository-evidence';
import {
  GithubLanguagesProjection,
  GithubRepositoryProjection,
  MAX_PRIMARY_LANGUAGE_LENGTH,
  truncateCodePoints,
} from './project-github-repository';
import type { GithubRepoProblem } from './classify-github-response';

/** Estado de un repositorio que no es `OK` (D8): el repo no se publica, pero el panel lo muestra. */
export type RepositoryProblem = GithubRepoProblem | 'PRIVATE';

/** Sella el contenido: `changedAt` solo avanza si el contenido cambió respecto de `existing`. */
function stamp(
  content: RepositoryEvidenceContent,
  existing: RepositoryEvidence | null,
  now: Date,
): RepositoryEvidence {
  const unchanged = existing !== null && sameEvidenceContent(existing, content);
  return { ...content, verifiedAt: now, changedAt: unchanged ? existing.changedAt : now };
}

/**
 * Evidencia `OK` a partir de las dos proyecciones (D8). `existing` es la evidencia anterior DEL
 * MISMO repositorio (mismo `repoKey`) o `null`. Un 304 o un 200 con la misma proyección dan el
 * mismo contenido: solo se mueve `verifiedAt` y `changedAt` queda igual.
 */
export function buildOkEvidence(input: {
  repoKey: string;
  repository: GithubRepositoryProjection;
  languages: GithubLanguagesProjection;
  existing: RepositoryEvidence | null;
  now: Date;
}): RepositoryEvidence {
  const { repoKey, repository, languages, existing, now } = input;
  const fullName = repository.full_name?.toLowerCase() ?? null;
  return stamp(
    {
      repoKey,
      status: 'OK',
      stars: repository.stargazers_count,
      primaryLanguage:
        repository.language === null
          ? null
          : truncateCodePoints(repository.language, MAX_PRIMARY_LANGUAGE_LENGTH),
      languages: { ...languages },
      topics: [...repository.topics],
      pushedAt: repository.pushed_at === null ? null : new Date(repository.pushed_at),
      archived: repository.archived ?? false,
      isFork: repository.fork ?? false,
      movedTo: fullName !== null && fullName !== repoKey ? repository.full_name : null,
      githubDescription: repository.description,
    },
    existing,
    now,
  );
}

/**
 * Evidencia de un repositorio no encontrado, sin acceso o privado: cambian `status` y `verifiedAt`
 * y los datos anteriores del mismo repositorio se conservan para el panel (la lectura pública no
 * los publica, D10). Sin evidencia previa quedan vacíos.
 */
export function buildProblemEvidence(input: {
  repoKey: string;
  status: RepositoryProblem;
  existing: RepositoryEvidence | null;
  now: Date;
}): RepositoryEvidence {
  const { repoKey, status, existing, now } = input;
  return stamp(
    {
      repoKey,
      status,
      stars: existing?.stars ?? null,
      primaryLanguage: existing?.primaryLanguage ?? null,
      languages: existing?.languages ?? null,
      topics: existing ? [...existing.topics] : [],
      pushedAt: existing?.pushedAt ?? null,
      archived: existing?.archived ?? false,
      isFork: existing?.isFork ?? false,
      movedTo: existing?.movedTo ?? null,
      githubDescription: existing?.githubDescription ?? null,
    },
    existing,
    now,
  );
}

/** ¿Cambió el contenido respecto de lo que había? (sin evidencia previa también cuenta). */
export function evidenceChanged(
  existing: RepositoryEvidence | null,
  next: RepositoryEvidence,
): boolean {
  return existing === null || !sameEvidenceContent(existing, next);
}

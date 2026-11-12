import { TagVocabulary } from '../../../../shared/domain/tag-vocabulary';

/** Cantidad máxima de tags que se sugieren marcados (D12). */
export const MAX_SUGGESTED_TAGS = 8;

export interface CoveredTag {
  readonly tag: string;
  /** Cantidad de ítems visibles del owner que llevan el tag. */
  readonly evidence: number;
}

export interface TagCoverage {
  /** Detectados que están en el vocabulario: por evidencia descendente y tag ascendente. */
  readonly covered: CoveredTag[];
  /** Detectados sin respaldo en los datos del owner, en orden alfabético. */
  readonly uncovered: string[];
  readonly detectedCount: number;
  readonly coveredCount: number;
  /** `coveredCount / detectedCount` a dos decimales; `null` si no se detectó nada. */
  readonly ratio: number | null;
  /** Los primeros `MAX_SUGGESTED_TAGS` de `covered`. Siempre ⊆ vocabulario y sin repetidos. */
  readonly suggestedFilterTags: string[];
}

/**
 * Cobertura de la vacante sobre el vocabulario del owner (D12, pura). Los términos repetidos se
 * cuentan una vez, así `coveredCount + uncovered.length = detectedCount`.
 */
export function computeTagCoverage(
  detectedTerms: readonly string[],
  vocabulary: TagVocabulary,
): TagCoverage {
  const detected = [...new Set(detectedTerms)];
  const inVocabulary = new Set(vocabulary.tags);

  const covered: CoveredTag[] = detected
    .filter((term) => inVocabulary.has(term))
    .map((tag) => ({ tag, evidence: vocabulary.evidence.get(tag) ?? 0 }))
    .sort((a, b) => b.evidence - a.evidence || a.tag.localeCompare(b.tag));
  const uncovered = detected.filter((term) => !inVocabulary.has(term)).sort();

  return {
    covered,
    uncovered,
    detectedCount: detected.length,
    coveredCount: covered.length,
    ratio:
      detected.length === 0 ? null : Math.round((covered.length / detected.length) * 100) / 100,
    suggestedFilterTags: covered.slice(0, MAX_SUGGESTED_TAGS).map((entry) => entry.tag),
  };
}

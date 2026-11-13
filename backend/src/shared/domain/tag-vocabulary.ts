/**
 * Vocabulario de tags del owner (change `add-job-posting-intake`, D12): el universo de tags que
 * sus datos usan de verdad. Es el mismo criterio que la regla `curated.unmatched-filter-tag` de
 * `cv-consistency`: solo cuentan los ítems visibles (experiencias y proyectos con `visible`; las
 * skills siempre aportan, el que llama las pasa con `visible: true`). Así un tag sugerido nunca
 * dispara ese hallazgo. Lo usan `job-posting` (sugerencia) y `curated-profile` (validación del
 * borrador), cada uno con su propio lector de datos.
 */
export interface TaggedItem {
  readonly tags: readonly string[];
  readonly visible: boolean;
}

export interface TagVocabulary {
  /** Tags únicos en orden alfabético estable. */
  readonly tags: string[];
  /** Cantidad de ítems visibles que llevan cada tag (un ítem cuenta una vez por tag). */
  readonly evidence: Map<string, number>;
}

export function collectTagVocabulary(items: readonly TaggedItem[]): TagVocabulary {
  const evidence = new Map<string, number>();
  for (const item of items) {
    if (!item.visible) continue;
    for (const tag of new Set(item.tags)) {
      if (tag === '') continue;
      evidence.set(tag, (evidence.get(tag) ?? 0) + 1);
    }
  }
  const tags = [...evidence.keys()].sort();
  return { tags, evidence: new Map(tags.map((tag) => [tag, evidence.get(tag) ?? 0])) };
}

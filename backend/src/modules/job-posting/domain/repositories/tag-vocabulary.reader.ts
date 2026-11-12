import { TagVocabulary } from '../../../../shared/domain/tag-vocabulary';

export const TAG_VOCABULARY_READER = Symbol('JobPostingTagVocabularyReader');

/**
 * Lectura del vocabulario de tags del owner (D12). Solo lectura de tags y visibilidad: el módulo
 * no conoce ni escribe nada de `curated-profile`.
 */
export interface TagVocabularyReader {
  read(): Promise<TagVocabulary>;
}

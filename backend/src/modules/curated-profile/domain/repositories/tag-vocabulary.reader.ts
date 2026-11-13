import { TagVocabulary } from '../../../../shared/domain/tag-vocabulary';

export const TAG_VOCABULARY_READER = Symbol('CuratedProfileTagVocabularyReader');

/**
 * Vocabulario de tags de los datos del owner (change `add-job-posting-intake`, D12/D17): lo que
 * valida los `filterTags` de un borrador desde una vacante. Solo lectura y propio de este módulo.
 */
export interface TagVocabularyReader {
  read(): Promise<TagVocabulary>;
}

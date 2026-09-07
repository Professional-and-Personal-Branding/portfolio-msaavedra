import { LocalizedText } from '../../../../shared/domain/i18n';

export interface AdminSkillOutput {
  id: string;
  name: string;
  tags: string[];
  order: number;
  categoryId: string | null;
}

/** Salida admin: nombre bilingüe crudo + skills. */
export interface AdminSkillCategoryOutput {
  id: string;
  name: LocalizedText | string;
  order: number;
  skills: AdminSkillOutput[];
}

import { LocalizedText } from '../../../../shared/domain/i18n';

/** Salida del backoffice: la descripción SIN resolver (para editar ambos idiomas). */
export interface AdminFeaturedRepositoryOutput {
  id: string;
  name: string;
  url: string;
  language: string | null;
  description: LocalizedText | string;
  technologies: string[];
  tags: string[];
  order: number;
  visible: boolean;
}

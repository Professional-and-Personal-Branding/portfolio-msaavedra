import { LocalizedText } from '../../../../shared/domain/i18n';

/** Salida del backoffice: campos traducibles SIN resolver (para editar ambos idiomas). */
export interface AdminProjectOutput {
  id: string;
  name: string;
  role: LocalizedText | string;
  period: string;
  summary: LocalizedText | string;
  technologies: string[];
  tags: string[];
  url: string | null;
  order: number;
  visible: boolean;
}

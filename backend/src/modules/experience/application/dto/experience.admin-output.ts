import { LocalizedList, LocalizedText } from '../../../../shared/domain/i18n';

/** Salida del backoffice: campos traducibles SIN resolver (para editar ambos idiomas). */
export interface AdminExperienceOutput {
  id: string;
  company: string;
  role: LocalizedText | string;
  startDate: string;
  endDate: string | null;
  current: boolean;
  location: string;
  summary: LocalizedText | string;
  highlights: LocalizedList | string[];
  technologies: string[];
  tags: string[];
  sector: string[];
  order: number;
  visible: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

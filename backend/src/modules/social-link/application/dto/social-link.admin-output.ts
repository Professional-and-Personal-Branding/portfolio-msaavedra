import { LocalizedText } from '../../../../shared/domain/i18n';

/** Salida del backoffice: campos traducibles SIN resolver (para editar ambos idiomas). */
export interface AdminSocialLinkOutput {
  id: string;
  platform: string;
  handle: string;
  url: string;
  label: LocalizedText | string;
  description: LocalizedText | string | null;
  stats: Record<string, unknown> | null;
  featured: boolean;
  order: number;
  visible: boolean;
}

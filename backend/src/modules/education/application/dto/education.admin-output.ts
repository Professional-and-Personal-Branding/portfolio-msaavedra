import { LocalizedText } from '../../../../shared/domain/i18n';

/** Salida del backoffice: campos traducibles SIN resolver (para editar ambos idiomas). */
export interface AdminEducationOutput {
  id: string;
  degree: LocalizedText | string;
  institution: string;
  startDate: string;
  endDate: string | null;
  inProgress: boolean;
  order: number;
  visible: boolean;
}

export interface AdminCertificationOutput {
  id: string;
  name: LocalizedText | string;
  issuer: string;
  year: string | null;
  verificationUrl: string | null;
  credentialId: string | null;
  expiresAt: string | null;
  order: number;
  visible: boolean;
}

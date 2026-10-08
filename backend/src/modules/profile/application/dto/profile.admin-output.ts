import { LocalizedText } from '../../../../shared/domain/i18n';

/** Disponibilidad cruda: cada campo bilingüe, o null si no está cargado. */
export interface AdminAvailabilityOutput {
  modality: LocalizedText | string | null;
  contractType: LocalizedText | string | null;
  startDate: LocalizedText | string | null;
}

/**
 * Perfil base para el backoffice: campos traducibles SIN resolver (para editar
 * ambos idiomas). Los idiomas no vienen acá: tienen su propia API (D2).
 */
export interface AdminProfileOutput {
  id: string;
  fullName: string;
  headline: LocalizedText | string;
  summary: LocalizedText | string;
  location: string;
  timezone: string;
  email: string;
  phone: string | null;
  yearsOfExperience: number;
  availability: AdminAvailabilityOutput;
}

export interface AdminLanguageOutput {
  id: string;
  name: string;
  nameI18n: LocalizedText | string | null;
  level: string;
  detail: LocalizedText | string | null;
}

/**
 * DTO de salida del perfil: todos los campos traducibles ya resueltos al locale
 * del request (strings planos). Tipo puro, sin decoradores: el modelo Swagger
 * lo implementa en infrastructure/controllers/docs.
 */
export interface LanguageOutput {
  name: string;
  level: string;
  detail: string;
}

export interface AvailabilityOutput {
  modality: string;
  contractType: string;
  startDate: string;
}

export interface ProfileOutput {
  id: string;
  fullName: string;
  headline: string;
  location: string;
  timezone: string;
  email: string;
  phone: string | null;
  summary: string;
  yearsOfExperience: number;
  availability: AvailabilityOutput;
  languages: LanguageOutput[];
}

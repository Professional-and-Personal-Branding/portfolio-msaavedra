export interface EducationOutput {
  id: string;
  degree: string;
  institution: string;
  startDate: string;
  endDate: string | null;
  inProgress: boolean;
  order: number;
}

export interface CertificationOutput {
  id: string;
  name: string;
  issuer: string;
  year: string | null;
  /** URL https de la página pública de la credencial en el emisor. */
  verificationUrl: string | null;
  credentialId: string | null;
  /** `YYYY-MM` o `YYYY`. La vigencia la deriva el cliente (D5): el backend no la calcula. */
  expiresAt: string | null;
  order: number;
}

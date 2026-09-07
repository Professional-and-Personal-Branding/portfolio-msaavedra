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
  order: number;
}

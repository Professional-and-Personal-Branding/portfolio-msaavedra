/**
 * Documento JSON Resume v1.0.0 (https://jsonresume.org/schema), con solo las claves que el change
 * `add-json-resume-export` emite (D4). Tipo puro: el contrato es el estándar externo y no se
 * duplica en decoradores Swagger (D10). Las claves salen siempre en este orden.
 */
export interface JsonResumeProfile {
  network?: string;
  username?: string;
  url?: string;
}

export interface JsonResumeBasics {
  name?: string;
  label?: string;
  email?: string;
  phone?: string;
  url?: string;
  summary?: string;
  location?: { address: string };
  profiles?: JsonResumeProfile[];
}

export interface JsonResumeWork {
  name: string;
  position?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  summary?: string;
  highlights?: string[];
}

export interface JsonResumeEducation {
  institution: string;
  area?: string;
  startDate?: string;
  endDate?: string;
}

export interface JsonResumeCertificate {
  name: string;
  issuer?: string;
  url?: string;
}

export interface JsonResumeSkill {
  name: string;
  keywords: string[];
}

export interface JsonResumeLanguage {
  language: string;
  fluency?: string;
}

export interface JsonResumeProject {
  name: string;
  description?: string;
  roles?: string[];
  keywords?: string[];
  startDate?: string;
  endDate?: string;
  url?: string;
  /** `repository` para los repositorios destacados (change `add-featured-repositories`, D10). */
  type?: string;
}

export interface JsonResumeMeta {
  canonical: string;
  version: string;
  lastModified?: string;
}

export interface JsonResumeOutput {
  $schema: string;
  basics: JsonResumeBasics;
  work?: JsonResumeWork[];
  education?: JsonResumeEducation[];
  certificates?: JsonResumeCertificate[];
  skills?: JsonResumeSkill[];
  languages?: JsonResumeLanguage[];
  projects?: JsonResumeProject[];
  meta: JsonResumeMeta;
}

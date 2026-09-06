/**
 * DTO de salida de una experiencia: campos traducibles ya resueltos al locale.
 * Tipo puro, sin decoradores (el modelo Swagger vive en infrastructure/controllers/docs).
 * No expone `visible`, `createdAt` ni `updatedAt` (spec `public-experience-api`).
 */
export interface ExperienceOutput {
  id: string;
  company: string;
  role: string;
  startDate: string;
  endDate: string | null;
  current: boolean;
  location: string;
  sector: string[];
  summary: string;
  highlights: string[];
  technologies: string[];
  tags: string[];
  order: number;
}

export interface ProjectOutput {
  id: string;
  name: string;
  role: string;
  period: string;
  summary: string;
  technologies: string[];
  tags: string[];
  url: string | null;
  order: number;
}

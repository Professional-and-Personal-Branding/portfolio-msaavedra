export interface FeaturedRepositoryOutput {
  id: string;
  name: string;
  url: string;
  language: string | null;
  description: string;
  technologies: string[];
  tags: string[];
  order: number;
}

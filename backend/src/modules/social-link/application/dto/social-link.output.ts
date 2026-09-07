export interface SocialLinkOutput {
  id: string;
  platform: string;
  handle: string;
  url: string;
  label: string;
  description: string;
  stats: Record<string, unknown> | null;
  featured: boolean;
  order: number;
}

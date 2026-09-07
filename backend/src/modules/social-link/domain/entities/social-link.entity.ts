import { LocalizedText } from '../../../../shared/domain/i18n';

export interface SocialLinkProps {
  readonly id: string;
  /** 'github' | 'linkedin' | 'youtube' | … */
  readonly platform: string;
  readonly handle: string;
  readonly url: string;
  readonly label: LocalizedText | string;
  readonly description: LocalizedText | string | null;
  /** Estructura libre (ej. `{ repos: 67, achievements: [...] }`). */
  readonly stats: Record<string, unknown> | null;
  readonly featured: boolean;
  readonly order: number;
  readonly visible: boolean;
}

/** Presencia pública (redes, código, video). */
export class SocialLink {
  private constructor(private readonly props: SocialLinkProps) {}

  static create(props: SocialLinkProps): SocialLink {
    return new SocialLink({ ...props, stats: props.stats ? structuredClone(props.stats) : null });
  }

  get id(): string {
    return this.props.id;
  }
  get platform(): string {
    return this.props.platform;
  }
  get handle(): string {
    return this.props.handle;
  }
  get url(): string {
    return this.props.url;
  }
  get label(): LocalizedText | string {
    return this.props.label;
  }
  get description(): LocalizedText | string | null {
    return this.props.description;
  }
  get stats(): Record<string, unknown> | null {
    return this.props.stats ? structuredClone(this.props.stats) : null;
  }
  get featured(): boolean {
    return this.props.featured;
  }
  get order(): number {
    return this.props.order;
  }
  get visible(): boolean {
    return this.props.visible;
  }
}

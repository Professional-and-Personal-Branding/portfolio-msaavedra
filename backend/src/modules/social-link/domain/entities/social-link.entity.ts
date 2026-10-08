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

/** Datos para crear un enlace social: el id lo genera la persistencia. */
export type NewSocialLinkProps = Omit<SocialLinkProps, 'id'>;

const cloneStats = (stats: Record<string, unknown> | null): Record<string, unknown> | null =>
  stats ? structuredClone(stats) : null;

/** Presencia pública (redes, código, video). */
export class SocialLink {
  private constructor(private readonly props: SocialLinkProps) {}

  static create(props: SocialLinkProps): SocialLink {
    return new SocialLink({ ...props, stats: cloneStats(props.stats) });
  }

  /** Copia con cambios parciales (edición desde el backoffice). */
  with(changes: Partial<NewSocialLinkProps>): SocialLink {
    return SocialLink.create({ ...this.props, ...changes });
  }

  toProps(): SocialLinkProps {
    return { ...this.props, stats: cloneStats(this.props.stats) };
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
    return cloneStats(this.props.stats);
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

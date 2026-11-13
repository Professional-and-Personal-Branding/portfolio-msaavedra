import { LocalizedText } from '../../../../shared/domain/i18n';

export interface FeaturedRepositoryProps {
  readonly id: string;
  readonly name: string;
  /** URL canónica `https://github.com/<owner>/<repo>` (ver `parseGithubRepositoryUrl`). */
  readonly url: string;
  readonly language: string | null;
  readonly description: LocalizedText | string;
  readonly technologies: readonly string[];
  /** Tags para el filtrado de perfiles curados. */
  readonly tags: readonly string[];
  readonly order: number;
  readonly visible: boolean;
}

/** Datos para crear un repositorio: el id lo genera la persistencia. */
export type NewFeaturedRepositoryProps = Omit<FeaturedRepositoryProps, 'id'>;

/**
 * Repositorio destacado de GitHub, cargado a mano. Participa del filtrado por tags
 * (implementa `Taggable`). `stars` no forma parte de la entidad: lo llenará la sincronización.
 */
export class FeaturedRepository {
  private constructor(private readonly props: FeaturedRepositoryProps) {}

  static create(props: FeaturedRepositoryProps): FeaturedRepository {
    return new FeaturedRepository({
      ...props,
      technologies: [...props.technologies],
      tags: [...props.tags],
    });
  }

  /** Copia con cambios parciales (edición desde el backoffice). */
  with(changes: Partial<NewFeaturedRepositoryProps>): FeaturedRepository {
    return FeaturedRepository.create({ ...this.props, ...changes });
  }

  toProps(): FeaturedRepositoryProps {
    return {
      ...this.props,
      technologies: [...this.props.technologies],
      tags: [...this.props.tags],
    };
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get url(): string {
    return this.props.url;
  }
  get language(): string | null {
    return this.props.language;
  }
  get description(): LocalizedText | string {
    return this.props.description;
  }
  get technologies(): readonly string[] {
    return this.props.technologies;
  }
  get tags(): readonly string[] {
    return this.props.tags;
  }
  get order(): number {
    return this.props.order;
  }
  get visible(): boolean {
    return this.props.visible;
  }
}

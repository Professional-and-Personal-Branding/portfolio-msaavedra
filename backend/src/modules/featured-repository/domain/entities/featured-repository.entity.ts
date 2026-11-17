import { LocalizedText } from '../../../../shared/domain/i18n';
import { RepositoryEvidence } from '../value-objects/repository-evidence';

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
  /**
   * Lo verificado contra GitHub (change `add-github-code-evidence`). Solo se LEE: la escribe la
   * sincronización y nunca forma parte de lo que guarda el panel.
   */
  readonly evidence?: RepositoryEvidence | null;
}

/** Datos para crear un repositorio: el id lo genera la persistencia y la evidencia no se escribe. */
export type NewFeaturedRepositoryProps = Omit<FeaturedRepositoryProps, 'id' | 'evidence'>;

/**
 * Repositorio destacado de GitHub, cargado a mano. Participa del filtrado por tags
 * (implementa `Taggable`). Las stars y demás datos verificados viven en `evidence`, no en la fila.
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
  get evidence(): RepositoryEvidence | null {
    return this.props.evidence ?? null;
  }
}

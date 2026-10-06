import { LocalizedText } from '../../../../shared/domain/i18n';

export interface ProjectProps {
  readonly id: string;
  readonly name: string;
  readonly role: LocalizedText | string;
  readonly period: string;
  readonly summary: LocalizedText | string;
  readonly technologies: readonly string[];
  /** Tags para el filtrado de perfiles curados. */
  readonly tags: readonly string[];
  readonly url: string | null;
  readonly order: number;
  readonly visible: boolean;
}

/** Datos para crear un proyecto: el id lo genera la persistencia. */
export type NewProjectProps = Omit<ProjectProps, 'id'>;

/** Proyecto destacado. Participa del filtrado por tags (implementa `Taggable`). */
export class Project {
  private constructor(private readonly props: ProjectProps) {}

  static create(props: ProjectProps): Project {
    return new Project({
      ...props,
      technologies: [...props.technologies],
      tags: [...props.tags],
    });
  }

  /** Copia con cambios parciales (edición desde el backoffice). */
  with(changes: Partial<NewProjectProps>): Project {
    return Project.create({ ...this.props, ...changes });
  }

  toProps(): ProjectProps {
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
  get role(): LocalizedText | string {
    return this.props.role;
  }
  get period(): string {
    return this.props.period;
  }
  get summary(): LocalizedText | string {
    return this.props.summary;
  }
  get technologies(): readonly string[] {
    return this.props.technologies;
  }
  get tags(): readonly string[] {
    return this.props.tags;
  }
  get url(): string | null {
    return this.props.url;
  }
  get order(): number {
    return this.props.order;
  }
  get visible(): boolean {
    return this.props.visible;
  }
}

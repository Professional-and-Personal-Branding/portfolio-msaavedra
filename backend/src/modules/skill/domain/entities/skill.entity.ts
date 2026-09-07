export interface SkillProps {
  readonly id: string;
  /** Nombre de la tecnología/skill (no traducible). */
  readonly name: string;
  /** Tags para el filtrado de perfiles curados. */
  readonly tags: readonly string[];
  readonly order: number;
  /** Categoría a la que pertenece (informativo; la agrupación la hace SkillCategory). */
  readonly categoryId?: string;
}

/** Datos para crear una skill dentro de una categoría. */
export interface NewSkillProps {
  readonly name: string;
  readonly tags: readonly string[];
  readonly order: number;
}

export class Skill {
  private constructor(private readonly props: SkillProps) {}

  static create(props: SkillProps): Skill {
    return new Skill({ ...props, tags: [...props.tags] });
  }

  with(changes: Partial<NewSkillProps & { categoryId: string }>): Skill {
    return Skill.create({ ...this.props, ...changes });
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get tags(): readonly string[] {
    return this.props.tags;
  }
  get order(): number {
    return this.props.order;
  }
  get categoryId(): string | undefined {
    return this.props.categoryId;
  }
}

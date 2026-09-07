import { LocalizedText } from '../../../../shared/domain/i18n';
import { Skill } from './skill.entity';

export interface SkillCategoryProps {
  readonly id: string;
  readonly name: LocalizedText | string;
  readonly order: number;
  readonly skills: readonly Skill[];
}

/** Datos para crear una categoría (nace sin skills). */
export interface NewSkillCategoryProps {
  readonly name: LocalizedText | string;
  readonly order: number;
}

/** Categoría de skills (ej. "Lenguajes", "Cloud & DevOps"). Agregado raíz. */
export class SkillCategory {
  private constructor(private readonly props: SkillCategoryProps) {}

  static create(props: SkillCategoryProps): SkillCategory {
    return new SkillCategory({ ...props, skills: [...props.skills] });
  }

  get id(): string {
    return this.props.id;
  }
  get name(): LocalizedText | string {
    return this.props.name;
  }
  get order(): number {
    return this.props.order;
  }
  get skills(): readonly Skill[] {
    return this.props.skills;
  }

  /** Nueva categoría con un subconjunto de skills (no muta la original). */
  withSkills(skills: readonly Skill[]): SkillCategory {
    return SkillCategory.create({ ...this.props, skills });
  }

  /** Copia con cambios de nombre/orden (edición desde el backoffice). */
  with(changes: Partial<NewSkillCategoryProps>): SkillCategory {
    return SkillCategory.create({ ...this.props, ...changes });
  }
}

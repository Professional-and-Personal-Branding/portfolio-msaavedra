import { LocalizedList, LocalizedText } from '../../../../shared/domain/i18n';

export interface ExperienceProps {
  readonly id: string;
  readonly company: string;
  readonly role: LocalizedText | string;
  /** Formato YYYY-MM. */
  readonly startDate: string;
  /** Formato YYYY-MM; null = actual. */
  readonly endDate: string | null;
  readonly current: boolean;
  readonly location: string;
  readonly summary: LocalizedText | string;
  readonly highlights: LocalizedList | string[];
  readonly technologies: readonly string[];
  /** Tags para el filtrado de perfiles curados (Fase 2). */
  readonly tags: readonly string[];
  readonly sector: readonly string[];
  readonly order: number;
  readonly visible: boolean;
}

/**
 * Experiencia laboral. Bilingüe por diseño: la proyección a un idioma es
 * responsabilidad de la capa de aplicación.
 */
export class Experience {
  private constructor(private readonly props: ExperienceProps) {}

  static create(props: ExperienceProps): Experience {
    return new Experience({
      ...props,
      technologies: [...props.technologies],
      tags: [...props.tags],
      sector: [...props.sector],
    });
  }

  get id(): string {
    return this.props.id;
  }
  get company(): string {
    return this.props.company;
  }
  get role(): LocalizedText | string {
    return this.props.role;
  }
  get startDate(): string {
    return this.props.startDate;
  }
  get endDate(): string | null {
    return this.props.endDate;
  }
  get current(): boolean {
    return this.props.current;
  }
  get location(): string {
    return this.props.location;
  }
  get summary(): LocalizedText | string {
    return this.props.summary;
  }
  get highlights(): LocalizedList | string[] {
    return this.props.highlights;
  }
  get technologies(): readonly string[] {
    return this.props.technologies;
  }
  get tags(): readonly string[] {
    return this.props.tags;
  }
  get sector(): readonly string[] {
    return this.props.sector;
  }
  get order(): number {
    return this.props.order;
  }
  get visible(): boolean {
    return this.props.visible;
  }

  /** Regla de negocio: comparte al menos un tag con el conjunto dado (base de Fase 2). */
  matchesAnyTag(tags: readonly string[]): boolean {
    return this.props.tags.some((t) => tags.includes(t));
  }
}

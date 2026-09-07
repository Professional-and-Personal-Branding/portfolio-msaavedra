import { LocalizedText } from '../../../../shared/domain/i18n';

export interface EducationProps {
  readonly id: string;
  readonly degree: LocalizedText | string;
  readonly institution: string;
  /** YYYY-MM */
  readonly startDate: string;
  /** YYYY-MM; null si en curso. */
  readonly endDate: string | null;
  readonly inProgress: boolean;
  readonly order: number;
  readonly visible: boolean;
}

/** Formación académica. Bilingüe en `degree`. */
export class Education {
  private constructor(private readonly props: EducationProps) {}

  static create(props: EducationProps): Education {
    return new Education({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get degree(): LocalizedText | string {
    return this.props.degree;
  }
  get institution(): string {
    return this.props.institution;
  }
  get startDate(): string {
    return this.props.startDate;
  }
  get endDate(): string | null {
    return this.props.endDate;
  }
  get inProgress(): boolean {
    return this.props.inProgress;
  }
  get order(): number {
    return this.props.order;
  }
  get visible(): boolean {
    return this.props.visible;
  }
}

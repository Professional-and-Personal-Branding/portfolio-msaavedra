import { LocalizedText } from '../../../../shared/domain/i18n';

export interface CertificationProps {
  readonly id: string;
  readonly name: LocalizedText | string;
  readonly issuer: string;
  /** YYYY; null si no se conoce. */
  readonly year: string | null;
  readonly order: number;
  readonly visible: boolean;
}

/** Datos para crear una certificación: el id lo genera la persistencia. */
export type NewCertificationProps = Omit<CertificationProps, 'id'>;

/** Certificación o curso. Bilingüe en `name`. */
export class Certification {
  private constructor(private readonly props: CertificationProps) {}

  static create(props: CertificationProps): Certification {
    return new Certification({ ...props });
  }

  /** Copia con cambios parciales (edición desde el backoffice). */
  with(changes: Partial<NewCertificationProps>): Certification {
    return Certification.create({ ...this.props, ...changes });
  }

  toProps(): CertificationProps {
    return { ...this.props };
  }

  get id(): string {
    return this.props.id;
  }
  get name(): LocalizedText | string {
    return this.props.name;
  }
  get issuer(): string {
    return this.props.issuer;
  }
  get year(): string | null {
    return this.props.year;
  }
  get order(): number {
    return this.props.order;
  }
  get visible(): boolean {
    return this.props.visible;
  }
}

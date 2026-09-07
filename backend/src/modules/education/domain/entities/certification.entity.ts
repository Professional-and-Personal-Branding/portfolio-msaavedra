import { LocalizedText } from '../../../../shared/domain/i18n';

export interface CertificationProps {
  readonly id: string;
  readonly name: LocalizedText | string;
  readonly issuer: string;
  readonly year: string | null;
  readonly order: number;
  readonly visible: boolean;
}

/** Certificación o curso. Bilingüe en `name`. */
export class Certification {
  private constructor(private readonly props: CertificationProps) {}

  static create(props: CertificationProps): Certification {
    return new Certification({ ...props });
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

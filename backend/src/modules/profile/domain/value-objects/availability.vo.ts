import { LocalizedText } from '../../../../shared/domain/i18n';

export interface AvailabilityProps {
  readonly modality: LocalizedText | string | null;
  readonly contractType: LocalizedText | string | null;
  readonly startDate: LocalizedText | string | null;
}

/** Disponibilidad laboral (modalidad, tipo de contrato, fecha de inicio). Inmutable. */
export class Availability {
  private constructor(private readonly props: AvailabilityProps) {}

  static create(props: AvailabilityProps): Availability {
    return new Availability({ ...props });
  }

  get modality(): LocalizedText | string | null {
    return this.props.modality;
  }
  get contractType(): LocalizedText | string | null {
    return this.props.contractType;
  }
  get startDate(): LocalizedText | string | null {
    return this.props.startDate;
  }
}

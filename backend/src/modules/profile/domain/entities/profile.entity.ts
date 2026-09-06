import { LocalizedText } from '../../../../shared/domain/i18n';
import { Availability } from '../value-objects/availability.vo';
import { Language } from './language.entity';

export interface ProfileProps {
  readonly id: string;
  readonly fullName: string;
  readonly headline: LocalizedText | string;
  readonly location: string;
  readonly timezone: string;
  readonly email: string;
  readonly phone: string | null;
  readonly summary: LocalizedText | string;
  readonly yearsOfExperience: number;
  readonly availability: Availability;
  readonly languages: readonly Language[];
}

/**
 * Perfil profesional base (agregado raíz). Los campos traducibles se guardan
 * bilingües; la proyección a un idioma ocurre en la capa de aplicación.
 */
export class Profile {
  private constructor(private readonly props: ProfileProps) {}

  static create(props: ProfileProps): Profile {
    return new Profile({ ...props, languages: [...props.languages] });
  }

  get id(): string {
    return this.props.id;
  }
  get fullName(): string {
    return this.props.fullName;
  }
  get headline(): LocalizedText | string {
    return this.props.headline;
  }
  get location(): string {
    return this.props.location;
  }
  get timezone(): string {
    return this.props.timezone;
  }
  get email(): string {
    return this.props.email;
  }
  get phone(): string | null {
    return this.props.phone;
  }
  get summary(): LocalizedText | string {
    return this.props.summary;
  }
  get yearsOfExperience(): number {
    return this.props.yearsOfExperience;
  }
  get availability(): Availability {
    return this.props.availability;
  }
  get languages(): readonly Language[] {
    return this.props.languages;
  }
}

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
 * Contenido editable del perfil base (add-profile-content-admin, D1): todo menos
 * el id y los idiomas, que tienen su propia API. Un `PUT` lo reemplaza entero.
 */
export type ProfileContent = Omit<ProfileProps, 'id' | 'languages'>;

/**
 * Perfil profesional base (agregado raíz). Los campos traducibles se guardan
 * bilingües; la proyección a un idioma ocurre en la capa de aplicación.
 */
export class Profile {
  private constructor(private readonly props: ProfileProps) {}

  static create(props: ProfileProps): Profile {
    return new Profile({ ...props, languages: [...props.languages] });
  }

  /** Copia con el contenido reemplazado; conserva id e idiomas. */
  withContent(content: ProfileContent): Profile {
    return Profile.create({ ...content, id: this.props.id, languages: this.props.languages });
  }

  /** El contenido editable, tal como lo persiste el adaptador. */
  content(): ProfileContent {
    const p = this.props;
    return {
      fullName: p.fullName,
      headline: p.headline,
      location: p.location,
      timezone: p.timezone,
      email: p.email,
      phone: p.phone,
      summary: p.summary,
      yearsOfExperience: p.yearsOfExperience,
      availability: p.availability,
    };
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

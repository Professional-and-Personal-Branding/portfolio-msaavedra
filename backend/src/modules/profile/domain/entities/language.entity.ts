import { LocalizedText } from '../../../../shared/domain/i18n';

export interface LanguageProps {
  readonly id: string;
  /** Nombre canónico (no traducible); se usa como fallback de `nameI18n`. */
  readonly name: string;
  readonly nameI18n: LocalizedText | string | null;
  readonly level: string;
  readonly detail: LocalizedText | string | null;
}

/** Datos para crear un idioma: el id lo genera la persistencia. */
export type NewLanguageProps = Omit<LanguageProps, 'id'>;

/** Idioma que habla la persona (ej. Español nativo, Inglés B2). */
export class Language {
  private constructor(private readonly props: LanguageProps) {}

  static create(props: LanguageProps): Language {
    return new Language({ ...props });
  }

  /** Copia con cambios parciales (edición desde el backoffice). */
  with(changes: Partial<NewLanguageProps>): Language {
    return Language.create({ ...this.props, ...changes });
  }

  toProps(): LanguageProps {
    return { ...this.props };
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get nameI18n(): LocalizedText | string | null {
    return this.props.nameI18n;
  }
  get level(): string {
    return this.props.level;
  }
  get detail(): LocalizedText | string | null {
    return this.props.detail;
  }
}

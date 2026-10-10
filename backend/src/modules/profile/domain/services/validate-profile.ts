import { ValidationError } from '../../../../shared/domain/errors';
import { LocalizedText } from '../../../../shared/domain/i18n';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { NewLanguageProps } from '../entities/language.entity';
import { ProfileContent } from '../entities/profile.entity';

/** Forma mínima de un email: algo, una arroba, un dominio con punto. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Texto en el idioma origen (`es`), o el texto plano legacy. */
function sourceText(value: LocalizedText | string | null): string {
  if (value === null) return '';
  return typeof value === 'string' ? value : (value.es ?? '');
}

const isBlank = (value: string) => value.trim().length === 0;

/**
 * Reglas del perfil base (spec `admin-content-management`, D1). Un `PUT`
 * reemplaza todo, así que lo que el hero necesita no puede quedar vacío: el
 * mismo perfil aparece en todos los links a la vez.
 */
export function validateProfileContent(content: ProfileContent): Result<void, ValidationError> {
  if (isBlank(content.fullName)) {
    return fail(new ValidationError('fullName es obligatorio', ['fullName']));
  }
  if (isBlank(sourceText(content.headline))) {
    return fail(new ValidationError('headline.es es obligatorio', ['headline']));
  }
  if (isBlank(sourceText(content.summary))) {
    return fail(new ValidationError('summary.es es obligatorio', ['summary']));
  }
  if (!EMAIL_REGEX.test(content.email)) {
    return fail(new ValidationError('email no es válido', ['email']));
  }
  if (isBlank(content.location)) {
    return fail(new ValidationError('location es obligatorio', ['location']));
  }
  if (!Number.isInteger(content.yearsOfExperience) || content.yearsOfExperience < 0) {
    return fail(
      new ValidationError('yearsOfExperience debe ser un entero ≥ 0', ['yearsOfExperience']),
    );
  }
  return ok(undefined);
}

/** Reglas de un idioma: nombre y nivel (en español, o el texto plano legado) no vacíos. */
export function validateLanguage(props: NewLanguageProps): Result<void, ValidationError> {
  if (isBlank(props.name)) return fail(new ValidationError('name es obligatorio', ['name']));
  if (isBlank(sourceText(props.level))) {
    return fail(new ValidationError('level.es es obligatorio', ['level']));
  }
  return ok(undefined);
}

import { ValidationError } from '../../../../shared/domain/errors';
import { isHttpUrl } from '../../../../shared/domain/http-url';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { NewSocialLinkProps } from '../entities/social-link.entity';

/** Identificador de plataforma: minúsculas, dígitos y guiones (`github`, `dev-to`). */
const PLATFORM_PATTERN = /^[a-z0-9-]+$/;

function labelEs(label: NewSocialLinkProps['label']): string {
  return typeof label === 'string' ? label : (label.es ?? '');
}

/** Objeto JSON plano: ni array, ni primitivo, ni instancia de otra clase. */
function isPlainJsonObject(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Reglas de dominio de un enlace social (spec `admin-content-management`):
 * plataforma en minúsculas, handle no vacío, `url` absoluta http(s), etiqueta
 * en español no vacía y `stats` nulo u objeto plano.
 */
export function validateSocialLink(props: NewSocialLinkProps): Result<void, ValidationError> {
  if (!PLATFORM_PATTERN.test(props.platform)) {
    return fail(
      new ValidationError('platform es obligatorio (minúsculas, dígitos y guiones)', ['platform']),
    );
  }
  if (props.handle.trim().length === 0) {
    return fail(new ValidationError('handle es obligatorio', ['handle']));
  }
  if (!isHttpUrl(props.url)) {
    return fail(new ValidationError('url debe ser una URL http(s) absoluta', ['url']));
  }
  if (labelEs(props.label).trim().length === 0) {
    return fail(new ValidationError('label.es es obligatorio', ['label']));
  }
  if (props.stats !== null && !isPlainJsonObject(props.stats)) {
    return fail(new ValidationError('stats debe ser un objeto JSON o null', ['stats']));
  }
  return ok(undefined);
}

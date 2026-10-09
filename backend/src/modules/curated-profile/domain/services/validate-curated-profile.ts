import { ValidationError } from '../../../../shared/domain/errors';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { NewCuratedProfileProps } from '../entities/curated-profile.entity';

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Reglas de dominio de un perfil curado (spec `admin-curated-profile-crud`), evaluadas
 * sobre el estado resultante: slug kebab-case y PROTECTED exige accessToken. Los colores
 * viven en `themeOverrides` y no se validan acá (retire-accent-color, D6).
 */
export function validateCuratedProfile(
  props: NewCuratedProfileProps,
): Result<void, ValidationError> {
  if (!SLUG_REGEX.test(props.slug)) {
    return fail(new ValidationError('slug debe ser kebab-case (a-z, 0-9, guiones)', ['slug']));
  }
  if (props.visibility === 'PROTECTED' && !props.accessToken.isSet) {
    return fail(
      new ValidationError('Un perfil PROTECTED requiere accessToken', [
        'visibility',
        'accessToken',
      ]),
    );
  }
  return ok(undefined);
}

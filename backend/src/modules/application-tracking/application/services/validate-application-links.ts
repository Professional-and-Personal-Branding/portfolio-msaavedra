import { ValidationError } from '../../../../shared/domain/errors';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { ApplicationReferenceReader } from '../../domain/repositories/application-reference.reader';

/**
 * Coherencia del vínculo con perfil y enlace (D7): el perfil existe; el enlace requiere perfil,
 * existe, es de ese perfil y es `MANUAL` (activo o revocado). Los dos son opcionales.
 */
export async function validateApplicationLinks(
  reader: ApplicationReferenceReader,
  curatedProfileId: string | null,
  shareLinkId: string | null,
): Promise<Result<void, ValidationError>> {
  if (curatedProfileId !== null && (await reader.findProfile(curatedProfileId)) === null) {
    return fail(new ValidationError('El perfil curado no existe', ['curatedProfileId']));
  }
  if (shareLinkId === null) return ok(undefined);
  if (curatedProfileId === null) {
    return fail(
      new ValidationError('Para asociar un enlace hay que elegir el perfil al que pertenece', [
        'shareLinkId',
      ]),
    );
  }
  const link = await reader.findShareLink(shareLinkId);
  if (link === null) {
    return fail(new ValidationError('El enlace de seguimiento no existe', ['shareLinkId']));
  }
  if (link.curatedProfileId !== curatedProfileId) {
    return fail(
      new ValidationError('El enlace de seguimiento no pertenece al perfil elegido', [
        'shareLinkId',
      ]),
    );
  }
  if (link.kind !== 'MANUAL') {
    return fail(
      new ValidationError('Solo se pueden asociar enlaces de seguimiento creados a mano', [
        'shareLinkId',
      ]),
    );
  }
  return ok(undefined);
}

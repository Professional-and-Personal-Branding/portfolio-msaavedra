import { Injectable } from '@nestjs/common';
import { Locale } from '../../../../../shared/domain/i18n';
import { ok, Ok } from '../../../../../shared/domain/result';
import {
  CuratedProfile,
  NewCuratedProfileProps,
} from '../../../domain/entities/curated-profile.entity';
import { CuratedProfileOutput } from '../../dto/curated-profile.output';
import { CuratedProfileComposer } from '../../services/curated-profile.composer';

/** Id de la entidad transitoria: nunca llega a la base ni al DTO de salida. */
export const PREVIEW_CURATED_PROFILE_ID = 'preview';

export interface PreviewCuratedProfileInput {
  draft: NewCuratedProfileProps;
  locale: Locale;
}

/**
 * Resuelve un perfil curado en borrador con el mismo pipeline que la ruta
 * pública, sin persistir nada y sin registrar visitas
 * (spec `admin-curated-profile-preview`). No puede fallar: el llamador ya es
 * un administrador autenticado y la visibilidad no se evalúa.
 */
@Injectable()
export class PreviewCuratedProfileUseCase {
  constructor(private readonly composer: CuratedProfileComposer) {}

  async execute(input: PreviewCuratedProfileInput): Promise<Ok<CuratedProfileOutput>> {
    const draft = CuratedProfile.create({
      ...input.draft,
      id: PREVIEW_CURATED_PROFILE_ID,
      views: 0,
    });
    return ok(await this.composer.compose(draft, input.locale));
  }
}

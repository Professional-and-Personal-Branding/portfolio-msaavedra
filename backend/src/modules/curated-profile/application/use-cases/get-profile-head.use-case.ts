import { Inject, Injectable } from '@nestjs/common';
import { Locale } from '../../../../shared/domain/i18n';
import { ok, Ok } from '../../../../shared/domain/result';
import {
  CURATED_PROFILE_REPOSITORY,
  CuratedProfileRepository,
} from '../../domain/repositories/curated-profile.repository';
import { resolvability } from '../../domain/services/resolvability';
import { CuratedProfileComposer } from '../services/curated-profile.composer';
import {
  genericHeadMeta,
  headMetaFromProfile,
  renderProfileHead,
} from '../services/profile-head.renderer';

export interface GetProfileHeadInput {
  slug: string;
  locale: Locale;
  /** Origen público del sitio (`FRONTEND_URL`), el mismo que usa el sitemap. */
  baseUrl: string;
}

/**
 * Fragmento de `<head>` para el HTML inicial de un perfil (spec `public-seo`).
 * No puede fallar: lo consume el borde, que necesita siempre algo que insertar.
 *
 * Solo un perfil `PUBLIC` y no archivado aporta sus textos (pedido por su slug o
 * por uno anterior: el canonical es siempre el vigente). Archivado, `PROTECTED`,
 * `PRIVATE` e inexistente dan el mismo fragmento genérico con `noindex`: el head
 * no autentica (no acepta token) y no debe filtrar lo que la visibilidad protege
 * ni revelar si existe. Tampoco registra visitas: lo pide el borde, no una persona.
 */
@Injectable()
export class GetProfileHeadUseCase {
  constructor(
    @Inject(CURATED_PROFILE_REPOSITORY) private readonly curatedProfiles: CuratedProfileRepository,
    private readonly composer: CuratedProfileComposer,
  ) {}

  async execute(input: GetProfileHeadInput): Promise<Ok<string>> {
    const curated = input.slug ? await this.curatedProfiles.findBySlugOrAlias(input.slug) : null;
    // Solo lo que resuelve sin token aporta sus textos: la misma tabla de verdad
    // que la ruta pública. Archivado, PROTECTED, PRIVATE e inexistente → genérico.
    if (!curated || resolvability(curated.visibility, curated.archivedAt, false) !== 'ok') {
      return ok(renderProfileHead(genericHeadMeta(input.locale, input.baseUrl), input.baseUrl));
    }

    const resolved = await this.composer.compose(curated, input.locale);
    return ok(
      renderProfileHead(headMetaFromProfile(resolved, input.locale, input.baseUrl), input.baseUrl),
    );
  }
}

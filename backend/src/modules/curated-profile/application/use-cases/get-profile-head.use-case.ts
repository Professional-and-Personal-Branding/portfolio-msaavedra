import { Inject, Injectable } from '@nestjs/common';
import { Locale } from '../../../../shared/domain/i18n';
import { ok, Ok } from '../../../../shared/domain/result';
import {
  CURATED_PROFILE_REPOSITORY,
  CuratedProfileRepository,
} from '../../domain/repositories/curated-profile.repository';
import { CuratedProfileComposer } from '../services/curated-profile.composer';
import { ProfileHeadCache } from '../services/profile-head.cache';
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
 * Solo un perfil `PUBLIC` aporta sus textos. `PROTECTED`, `PRIVATE` e inexistente
 * dan el mismo fragmento genérico con `noindex`: el head no autentica (no acepta
 * token) y no debe filtrar lo que la visibilidad protege ni revelar si existe.
 * Tampoco registra visitas: lo pide el borde, no una persona.
 *
 * La ruta está exenta del límite de peticiones, así que el fragmento de un perfil
 * público se guarda un minuto (`ProfileHeadCache`): repetir la petición no vuelve
 * a componer el perfil contra la base.
 */
@Injectable()
export class GetProfileHeadUseCase {
  constructor(
    @Inject(CURATED_PROFILE_REPOSITORY) private readonly curatedProfiles: CuratedProfileRepository,
    private readonly composer: CuratedProfileComposer,
    private readonly cache: ProfileHeadCache,
  ) {}

  async execute(input: GetProfileHeadInput): Promise<Ok<string>> {
    const curated = input.slug ? await this.curatedProfiles.findBySlug(input.slug) : null;
    if (!curated || curated.visibility !== 'PUBLIC') {
      return ok(renderProfileHead(genericHeadMeta(input.locale, input.baseUrl), input.baseUrl));
    }

    // Por slug pedido, no por el vigente: así un slug anterior también se ahorra la composición.
    const key = `${input.slug}|${input.locale}|${input.baseUrl}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) return ok(cached);

    const resolved = await this.composer.compose(curated, input.locale);
    const html = renderProfileHead(
      headMetaFromProfile(resolved, input.locale, input.baseUrl),
      input.baseUrl,
    );
    this.cache.set(key, html);
    return ok(html);
  }
}

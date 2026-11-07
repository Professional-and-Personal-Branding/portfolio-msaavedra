import { Inject, Injectable } from '@nestjs/common';
import { Locale } from '../../../../shared/domain/i18n';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { CuratedVisibility } from '../../domain/entities/curated-profile.entity';
import { CuratedProfileNotFoundError } from '../../domain/errors/curated-profile-not-found.error';
import {
  CURATED_PROFILE_REPOSITORY,
  CuratedProfileRepository,
} from '../../domain/repositories/curated-profile.repository';
import { JsonResumeOutput } from '../dto/json-resume.output';
import { toJsonResume } from '../mappers/json-resume.mapper';
import { CuratedProfileComposer } from '../services/curated-profile.composer';
import {
  ResolveCuratedProfileError,
  ResolveCuratedProfileUseCase,
} from './resolve-curated-profile.use-case';

/** Documento más lo que la capa HTTP necesita para las cabeceras (D6). */
export interface ExportedResume {
  document: JsonResumeOutput;
  /** Slug canónico: nombra el archivo y la ruta de `Content-Location`. */
  slug: string;
  visibility: CuratedVisibility;
}

export interface ExportCuratedProfileResumeInput {
  slug: string;
  locale: Locale;
  /** Token presentado por el cliente (solo relevante para perfiles PROTECTED). */
  accessToken?: string | null;
  /** Origen público del sitio (`FRONTEND_URL`), el mismo que usa el sitemap. */
  baseUrl: string;
}

/**
 * Exportación pública a JSON Resume (spec `json-resume-export`). Reusa la resolución de la ruta
 * pública, con su misma tabla de acceso, **sin `viewContext`**: no registra visita, no lee la
 * sesión del panel ni la atribución (D2), así que una descarga no suma a `views`.
 */
@Injectable()
export class ExportCuratedProfileResumeUseCase {
  constructor(private readonly resolveCuratedProfile: ResolveCuratedProfileUseCase) {}

  async execute(
    input: ExportCuratedProfileResumeInput,
  ): Promise<Result<ExportedResume, ResolveCuratedProfileError>> {
    const resolved = await this.resolveCuratedProfile.execute({
      slug: input.slug,
      locale: input.locale,
      accessToken: input.accessToken,
    });
    if (!resolved.ok) return fail(resolved.error);

    const view = resolved.value;
    return ok({
      document: toJsonResume(view, { baseUrl: input.baseUrl, locale: input.locale }),
      slug: view.slug,
      visibility: view.visibility,
    });
  }
}

export interface ExportCuratedProfileResumeForAdminInput {
  id: string;
  locale: Locale;
  baseUrl: string;
}

/**
 * Exportación desde el panel (D7): lee lo guardado del perfil por id y usa el mismo composer y el
 * mismo mapper que la ruta pública, pero sin la tabla de acceso: el administrador exporta también
 * perfiles `PRIVATE`, `PROTECTED` (sin token) y archivados. Tampoco registra visita.
 */
@Injectable()
export class ExportCuratedProfileResumeForAdminUseCase {
  constructor(
    @Inject(CURATED_PROFILE_REPOSITORY) private readonly curatedProfiles: CuratedProfileRepository,
    private readonly composer: CuratedProfileComposer,
  ) {}

  async execute(
    input: ExportCuratedProfileResumeForAdminInput,
  ): Promise<Result<ExportedResume, CuratedProfileNotFoundError>> {
    const curated = await this.curatedProfiles.findById(input.id);
    if (!curated) return fail(new CuratedProfileNotFoundError(input.id));

    const view = await this.composer.compose(curated, input.locale);
    return ok({
      document: toJsonResume(view, { baseUrl: input.baseUrl, locale: input.locale }),
      slug: view.slug,
      visibility: view.visibility,
    });
  }
}

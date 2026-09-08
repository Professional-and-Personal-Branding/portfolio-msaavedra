import { Inject, Injectable, Logger } from '@nestjs/common';
import { Locale } from '../../../../shared/domain/i18n';
import { fail, ok, Result } from '../../../../shared/domain/result';
import {
  PROFILE_VIEW_REPOSITORY,
  ProfileViewRepository,
} from '../../../analytics/domain/repositories/profile-view.repository';
import { CuratedProfileAccessDeniedError } from '../../domain/errors/curated-profile-access-denied.error';
import { CuratedProfileNotFoundError } from '../../domain/errors/curated-profile-not-found.error';
import {
  CURATED_PROFILE_REPOSITORY,
  CuratedProfileRepository,
} from '../../domain/repositories/curated-profile.repository';
import { CuratedProfileOutput } from '../dto/curated-profile.output';
import { CuratedProfileComposer } from '../services/curated-profile.composer';

/** Contexto de la visita pública. Si viene, la resolución exitosa registra un ProfileView. */
export interface ViewContext {
  locale: Locale;
  referrer?: string;
  userAgent?: string;
  ipHash?: string;
}

export interface ResolveCuratedProfileInput {
  slug: string;
  locale: Locale;
  /** Token presentado por el cliente (solo relevante para perfiles PROTECTED). */
  accessToken?: string | null;
  /** Ausente en usos internos y tests: no se registra nada. */
  viewContext?: ViewContext;
}

export type ResolveCuratedProfileError =
  CuratedProfileNotFoundError | CuratedProfileAccessDeniedError;

/**
 * Núcleo del producto (CLAUDE.md § ResolveCuratedProfile).
 * Aquí viven los pasos 1, 2 y 6 (existencia/visibilidad, token de acceso y
 * registro de la visita); los pasos 3-5 y 7 los aporta `CuratedProfileComposer`,
 * compartido con el preview del backoffice.
 * El paso 6 nunca altera el resultado ni lo convierte en error.
 */
@Injectable()
export class ResolveCuratedProfileUseCase {
  private readonly logger = new Logger(ResolveCuratedProfileUseCase.name);

  constructor(
    @Inject(CURATED_PROFILE_REPOSITORY) private readonly curatedProfiles: CuratedProfileRepository,
    @Inject(PROFILE_VIEW_REPOSITORY) private readonly profileViews: ProfileViewRepository,
    private readonly composer: CuratedProfileComposer,
  ) {}

  async execute(
    input: ResolveCuratedProfileInput,
  ): Promise<Result<CuratedProfileOutput, ResolveCuratedProfileError>> {
    // 1. Existencia y visibilidad. PRIVATE se comporta como inexistente.
    const curated = await this.curatedProfiles.findBySlug(input.slug);
    if (!curated || curated.isPrivate) return fail(new CuratedProfileNotFoundError(input.slug));

    // 2. Acceso para PROTECTED.
    if (!curated.canAccess(input.accessToken)) return fail(new CuratedProfileAccessDeniedError());

    // 3-5 y 7. Datos, selección, tema, secciones y DTO.
    const output = await this.composer.compose(curated, input.locale);

    // 6. Registro de visita (solo con contexto; nunca rompe la respuesta).
    if (input.viewContext) await this.recordView(curated.id, input.viewContext);

    return ok(output);
  }

  private async recordView(curatedProfileId: string, ctx: ViewContext): Promise<void> {
    try {
      await this.profileViews.record({
        curatedProfileId,
        locale: ctx.locale,
        referrer: ctx.referrer,
        userAgent: ctx.userAgent,
        ipHash: ctx.ipHash,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`No se pudo registrar la visita de ${curatedProfileId}: ${message}`);
    }
  }
}

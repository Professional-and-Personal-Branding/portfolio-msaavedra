import { Inject, Injectable, Logger } from '@nestjs/common';
import { Locale } from '../../../../shared/domain/i18n';
import {
  ADMIN_SESSION_VERIFIER,
  AdminSessionVerifier,
} from '../../../../shared/application/admin-session-verifier';
import { BACKGROUND_TASKS, BackgroundTasks } from '../../../../shared/application/background-tasks';
import { fail, ok, Result } from '../../../../shared/domain/result';
import {
  PROFILE_VIEW_REPOSITORY,
  ProfileViewRepository,
} from '../../../analytics/domain/repositories/profile-view.repository';
import { classifyVisit } from '../../../analytics/domain/services/classify-visit';
import { CuratedProfileAccessDeniedError } from '../../domain/errors/curated-profile-access-denied.error';
import { CuratedProfileNotFoundError } from '../../domain/errors/curated-profile-not-found.error';
import {
  CURATED_PROFILE_REPOSITORY,
  CuratedProfileRepository,
} from '../../domain/repositories/curated-profile.repository';
import { resolvability } from '../../domain/services/resolvability';
import { CuratedProfileOutput } from '../dto/curated-profile.output';
import { CuratedProfileComposer } from '../services/curated-profile.composer';

/** Contexto de la visita pública. Si viene, la resolución exitosa registra un ProfileView. */
export interface ViewContext {
  locale: Locale;
  referrer?: string;
  userAgent?: string;
  ipHash?: string;
  /**
   * Token de sesión del panel tal como llegó (cookie o Bearer), sin validar. Se verifica
   * dentro de la tarea en segundo plano y nunca se persiste ni se escribe en el log.
   */
  sessionToken?: string;
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
 * El paso 6 nunca altera el resultado ni lo convierte en error, y no lo retrasa.
 */
@Injectable()
export class ResolveCuratedProfileUseCase {
  private readonly logger = new Logger(ResolveCuratedProfileUseCase.name);

  constructor(
    @Inject(CURATED_PROFILE_REPOSITORY) private readonly curatedProfiles: CuratedProfileRepository,
    @Inject(PROFILE_VIEW_REPOSITORY) private readonly profileViews: ProfileViewRepository,
    @Inject(BACKGROUND_TASKS) private readonly background: BackgroundTasks,
    @Inject(ADMIN_SESSION_VERIFIER) private readonly sessions: AdminSessionVerifier,
    private readonly composer: CuratedProfileComposer,
  ) {}

  async execute(
    input: ResolveCuratedProfileInput,
  ): Promise<Result<CuratedProfileOutput, ResolveCuratedProfileError>> {
    // 1-2. Existencia (por slug vigente o anterior) y acceso. La decisión es la
    // tabla de verdad de `resolvability`: archivado y PRIVATE se comportan como
    // inexistentes; PROTECTED sin token válido es 401.
    const curated = await this.curatedProfiles.findBySlugOrAlias(input.slug);
    if (!curated) return fail(new CuratedProfileNotFoundError(input.slug));
    const access = resolvability(
      curated.visibility,
      curated.archivedAt,
      curated.accessToken.matches(input.accessToken),
    );
    if (access === 'not-found') return fail(new CuratedProfileNotFoundError(input.slug));
    if (access === 'unauthorized') return fail(new CuratedProfileAccessDeniedError());

    // 3-5 y 7. Datos, selección, tema, secciones y DTO.
    const output = await this.composer.compose(curated, input.locale);

    // 6. Registro de visita (solo con contexto): se entrega al puerto de tareas en
    // segundo plano y la respuesta no lo espera; nunca rompe el resultado.
    const { viewContext } = input;
    if (viewContext) {
      this.background.run('record-profile-view', () => this.recordView(curated.id, viewContext));
    }

    return ok(output);
  }

  private async recordView(curatedProfileId: string, ctx: ViewContext): Promise<void> {
    try {
      const adminSession = await this.hasAdminSession(ctx.sessionToken);
      await this.profileViews.record({
        curatedProfileId,
        locale: ctx.locale,
        referrer: ctx.referrer,
        userAgent: ctx.userAgent,
        ipHash: ctx.ipHash,
        kind: classifyVisit({ adminSession, userAgent: ctx.userAgent }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`No se pudo registrar la visita de ${curatedProfileId}: ${message}`);
    }
  }

  /**
   * Una sesión ausente, vencida o un verificador que falla cuentan como «sin sesión»:
   * la visita se clasifica por User-Agent. El aviso no incluye el token ni el error
   * original (podría citarlo).
   */
  private async hasAdminSession(token: string | undefined): Promise<boolean> {
    if (!token) return false;
    try {
      return await this.sessions.isAdminSession(token);
    } catch {
      this.logger.warn('No se pudo validar la sesión de la visita; se clasifica sin sesión');
      return false;
    }
  }
}

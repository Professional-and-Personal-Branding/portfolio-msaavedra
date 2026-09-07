import { Inject, Injectable, Logger } from '@nestjs/common';
import { Locale } from '../../../../shared/domain/i18n';
import { fail, ok, Result } from '../../../../shared/domain/result';
import {
  PROFILE_VIEW_REPOSITORY,
  ProfileViewRepository,
} from '../../../analytics/domain/repositories/profile-view.repository';
import {
  EXPERIENCE_REPOSITORY,
  ExperienceRepository,
} from '../../../experience/domain/repositories/experience.repository';
import { sortExperiences } from '../../../experience/domain/services/sort-experiences';
import {
  PROFILE_REPOSITORY,
  ProfileRepository,
} from '../../../profile/domain/repositories/profile.repository';
import {
  SKILL_CATEGORY_REPOSITORY,
  SkillCategoryRepository,
} from '../../../skill/domain/repositories/skill-category.repository';
import { Theme } from '../../../theme/domain/entities/theme.entity';
import {
  DEFAULT_THEME_SLUG,
  THEME_REPOSITORY,
  ThemeRepository,
} from '../../../theme/domain/repositories/theme.repository';
import { mergeThemeTokens } from '../../../theme/domain/services/merge-theme-tokens';
import { CuratedProfileAccessDeniedError } from '../../domain/errors/curated-profile-access-denied.error';
import { CuratedProfileNotFoundError } from '../../domain/errors/curated-profile-not-found.error';
import {
  CURATED_PROFILE_REPOSITORY,
  CuratedProfileRepository,
} from '../../domain/repositories/curated-profile.repository';
import { resolveSections } from '../../domain/services/resolve-sections';
import { selectByTags, SelectionCriteria } from '../../domain/services/select-by-tags';
import { selectSkillCategories } from '../../domain/services/select-skill-categories';
import { CuratedProfileOutput } from '../dto/curated-profile.output';
import { toCuratedProfileOutput } from '../mappers/curated-profile.mapper';
import { PortfolioSectionsLoader } from '../services/portfolio-sections.loader';

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
 * Núcleo del producto (CLAUDE.md § ResolveCuratedProfile, pasos 1-7).
 * El paso 6 (registro de ProfileView) nunca altera el resultado ni lo convierte en error.
 */
@Injectable()
export class ResolveCuratedProfileUseCase {
  private readonly logger = new Logger(ResolveCuratedProfileUseCase.name);

  constructor(
    @Inject(CURATED_PROFILE_REPOSITORY) private readonly curatedProfiles: CuratedProfileRepository,
    @Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository,
    @Inject(EXPERIENCE_REPOSITORY) private readonly experiences: ExperienceRepository,
    @Inject(SKILL_CATEGORY_REPOSITORY) private readonly skillCategories: SkillCategoryRepository,
    @Inject(THEME_REPOSITORY) private readonly themes: ThemeRepository,
    @Inject(PROFILE_VIEW_REPOSITORY) private readonly profileViews: ProfileViewRepository,
    private readonly sectionsLoader: PortfolioSectionsLoader,
  ) {}

  async execute(
    input: ResolveCuratedProfileInput,
  ): Promise<Result<CuratedProfileOutput, ResolveCuratedProfileError>> {
    // 1. Existencia y visibilidad. PRIVATE se comporta como inexistente.
    const curated = await this.curatedProfiles.findBySlug(input.slug);
    if (!curated || curated.isPrivate) return fail(new CuratedProfileNotFoundError(input.slug));

    // 2. Acceso para PROTECTED.
    if (!curated.canAccess(input.accessToken)) return fail(new CuratedProfileAccessDeniedError());

    // 3. Lecturas en paralelo.
    const [profile, allExperiences, allCategories, theme, portfolio] = await Promise.all([
      this.profiles.findOne(),
      this.experiences.findAllVisible(),
      this.skillCategories.findAll(),
      this.resolveTheme(curated.themeId),
      this.sectionsLoader.load(),
    ]);

    const criteria: SelectionCriteria = {
      filterTags: curated.filterTags,
      includeIds: curated.includeIds,
      excludeIds: curated.excludeIds,
    };

    // 4. Experiencias y proyectos: solo visibles → selección por tags/overrides → orden.
    const experiences = sortExperiences(
      selectByTags(
        allExperiences.filter((e) => e.visible),
        criteria,
      ),
    );
    const projects = selectByTags(portfolio.projects, criteria).sort((a, b) => a.order - b.order);

    // 5. Skills por categoría (sin categorías vacías).
    const skillCategories = selectSkillCategories(allCategories, criteria);

    // Tema: base + overrides (merge profundo). Secciones.
    const resolvedTheme = theme
      ? { theme, tokens: mergeThemeTokens(theme.tokens, curated.themeOverrides) }
      : null;
    const sections = resolveSections(curated.sectionsOrder, curated.sectionsHidden);

    // 6. Registro de visita (solo con contexto; nunca rompe la respuesta).
    if (input.viewContext) await this.recordView(curated.id, input.viewContext);

    // 7. DTO de presentación.
    return ok(
      toCuratedProfileOutput({
        curated,
        locale: input.locale,
        profile,
        experiences,
        skillCategories,
        projects,
        education: portfolio.education,
        certifications: portfolio.certifications,
        socialLinks: portfolio.socialLinks,
        theme: resolvedTheme,
        sections,
      }),
    );
  }

  /** Tema propio → preset por defecto → null (la resolución nunca falla por el tema). */
  private async resolveTheme(themeId: string | null): Promise<Theme | null> {
    if (themeId) {
      const own = await this.themes.findById(themeId);
      if (own) return own;
    }
    return this.themes.findBySlug(DEFAULT_THEME_SLUG);
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

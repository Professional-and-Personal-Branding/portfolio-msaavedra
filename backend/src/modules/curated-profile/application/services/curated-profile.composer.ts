import { Inject, Injectable } from '@nestjs/common';
import { Locale } from '../../../../shared/domain/i18n';
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
import { CuratedProfile } from '../../domain/entities/curated-profile.entity';
import { resolveSections } from '../../domain/services/resolve-sections';
import { selectByTags, SelectionCriteria } from '../../domain/services/select-by-tags';
import { selectSkillCategories } from '../../domain/services/select-skill-categories';
import { CuratedProfileOutput } from '../dto/curated-profile.output';
import { toCuratedProfileOutput } from '../mappers/curated-profile.mapper';
import { PortfolioSectionsLoader } from './portfolio-sections.loader';

/**
 * Pasos 3-5 y 7 de `CLAUDE.md § ResolveCuratedProfile`: dado un perfil curado
 * (persistido o en borrador) reúne los datos, aplica la selección por tags con
 * overrides, resuelve tema y secciones y devuelve el DTO de presentación.
 *
 * Lo comparten la ruta pública (`ResolveCuratedProfileUseCase`, que añade
 * visibilidad, token y registro de visita) y el preview del backoffice
 * (`PreviewCuratedProfileUseCase`), para que no puedan divergir
 * (spec `admin-curated-profile-preview`).
 */
@Injectable()
export class CuratedProfileComposer {
  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository,
    @Inject(EXPERIENCE_REPOSITORY) private readonly experiences: ExperienceRepository,
    @Inject(SKILL_CATEGORY_REPOSITORY) private readonly skillCategories: SkillCategoryRepository,
    @Inject(THEME_REPOSITORY) private readonly themes: ThemeRepository,
    private readonly sectionsLoader: PortfolioSectionsLoader,
  ) {}

  async compose(curated: CuratedProfile, locale: Locale): Promise<CuratedProfileOutput> {
    // Lecturas en paralelo.
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

    // Experiencias y proyectos: solo visibles → selección por tags/overrides → orden.
    const experiences = sortExperiences(
      selectByTags(
        allExperiences.filter((e) => e.visible),
        criteria,
      ),
    );
    const projects = selectByTags(portfolio.projects, criteria).sort((a, b) => a.order - b.order);

    // Skills por categoría (sin categorías vacías).
    const skillCategories = selectSkillCategories(allCategories, criteria);

    // Tema: base + overrides (merge profundo). Secciones.
    const resolvedTheme = theme
      ? { theme, tokens: mergeThemeTokens(theme.tokens, curated.themeOverrides) }
      : null;
    const sections = resolveSections(curated.sectionsOrder, curated.sectionsHidden);

    return toCuratedProfileOutput({
      curated,
      locale,
      profile,
      experiences,
      skillCategories,
      projects,
      education: portfolio.education,
      certifications: portfolio.certifications,
      socialLinks: portfolio.socialLinks,
      theme: resolvedTheme,
      sections,
    });
  }

  /** Tema propio → preset por defecto → null (la resolución nunca falla por el tema). */
  private async resolveTheme(themeId: string | null): Promise<Theme | null> {
    if (themeId) {
      const own = await this.themes.findById(themeId);
      if (own) return own;
    }
    return this.themes.findBySlug(DEFAULT_THEME_SLUG);
  }
}

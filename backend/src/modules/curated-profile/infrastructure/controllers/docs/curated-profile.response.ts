import { ApiProperty } from '@nestjs/swagger';
import {
  CertificationResponse,
  EducationResponse,
} from '../../../../education/infrastructure/controllers/docs/education.response';
import { ProjectResponse } from '../../../../project/infrastructure/controllers/docs/project.response';
import { SocialLinkResponse } from '../../../../social-link/infrastructure/controllers/docs/social-link.response';
import { ExperienceResponse } from '../../../../experience/infrastructure/controllers/docs/experience.response';
import { ProfileResponse } from '../../../../profile/infrastructure/controllers/docs/profile.response';
import {
  CuratedProfileOutput,
  CuratedProfileSummaryOutput,
  ResolvedThemeOutput,
  SkillCategoryOutput,
} from '../../../application/dto/curated-profile.output';
import {
  CURATED_VISIBILITIES,
  CuratedVisibility,
} from '../../../domain/entities/curated-profile.entity';

export class CuratedProfileSummaryResponse implements CuratedProfileSummaryOutput {
  @ApiProperty({ example: 'tech-lead-dotnet' })
  slug!: string;

  @ApiProperty({ description: 'Resuelto al locale.', example: 'Tech Lead · .NET' })
  title!: string;

  @ApiProperty({ description: 'Resuelto al locale.' })
  headline!: string;

  @ApiProperty({ description: 'Resuelto al locale.' })
  description!: string;

  @ApiProperty({
    description: 'Tipo de rol para agrupar el menú. Resuelto al locale.',
    example: 'Tech Lead',
  })
  roleType!: string;

  @ApiProperty({ nullable: true, type: String, example: '.NET' })
  techFocus!: string | null;

  @ApiProperty({ example: 'classic' })
  layout!: string;
}

export class ResolvedThemeResponse implements ResolvedThemeOutput {
  @ApiProperty({ example: 'modern-dark' })
  slug!: string;

  @ApiProperty({ example: 'Modern Dark' })
  name!: string;

  @ApiProperty({ example: true })
  isPreset!: boolean;

  @ApiProperty({
    description: 'Design tokens ya combinados (tema base + overrides del perfil).',
    type: 'object',
    additionalProperties: true,
    example: { mode: 'dark', colors: { bg: '#0a0e1a', accent: '#38bdf8' } },
  })
  tokens!: Record<string, unknown>;
}

export class SkillCategoryResponse implements SkillCategoryOutput {
  @ApiProperty({ description: 'Resuelto al locale.', example: 'Lenguajes' })
  name!: string;

  @ApiProperty({ type: [String], example: ['Java (8-21)', 'TypeScript'] })
  skills!: string[];
}

export class CuratedProfileResponse
  extends CuratedProfileSummaryResponse
  implements CuratedProfileOutput
{
  @ApiProperty({ enum: CURATED_VISIBILITIES, example: 'PUBLIC' })
  visibility!: CuratedVisibility;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'date-time',
    description:
      'Última edición del perfil curado (UTC). Las visitas no la mueven; null solo en el preview de un borrador.',
    example: '2026-01-15T12:00:00.000Z',
  })
  updatedAt!: string | null;

  @ApiProperty({ type: [String], example: ['hero', 'stats', 'experience', 'skills', 'contact'] })
  sections!: string[];

  @ApiProperty({ type: [String], example: ['education'] })
  hiddenSections!: string[];

  @ApiProperty({ type: ResolvedThemeResponse, nullable: true })
  theme!: ResolvedThemeResponse | null;

  @ApiProperty({ type: ProfileResponse, nullable: true })
  profile!: ProfileResponse | null;

  @ApiProperty({
    type: [ExperienceResponse],
    description: 'Filtradas por tags/overrides, orden cronológico.',
  })
  experiences!: ExperienceResponse[];

  @ApiProperty({ type: [SkillCategoryResponse] })
  skillCategories!: SkillCategoryResponse[];

  @ApiProperty({ type: [ProjectResponse], description: 'Seleccionados por tags/overrides.' })
  projects!: ProjectResponse[];

  @ApiProperty({ type: [EducationResponse] })
  education!: EducationResponse[];

  @ApiProperty({ type: [CertificationResponse] })
  certifications!: CertificationResponse[];

  @ApiProperty({ type: [SocialLinkResponse] })
  socialLinks!: SocialLinkResponse[];
}

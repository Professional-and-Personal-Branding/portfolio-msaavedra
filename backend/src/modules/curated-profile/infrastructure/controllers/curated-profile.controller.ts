import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Locale } from '../../../../shared/domain/i18n';
import { toHttpException } from '../../../../shared/infrastructure/http/domain-error.mapper';
import { ErrorResponseDto } from '../../../../shared/infrastructure/http/error-response.dto';
import { LocaleQueryDto } from '../../../../shared/infrastructure/http/locale-query.dto';
import { RequestLocale } from '../../../../shared/infrastructure/http/request-locale.decorator';
import {
  CuratedProfileOutput,
  CuratedProfileSummaryOutput,
} from '../../application/dto/curated-profile.output';
import { ListCuratedProfilesUseCase } from '../../application/use-cases/list-curated-profiles.use-case';
import { ResolveCuratedProfileUseCase } from '../../application/use-cases/resolve-curated-profile.use-case';
import { AccessToken } from './access-token.decorator';
import {
  CuratedProfileResponse,
  CuratedProfileSummaryResponse,
} from './docs/curated-profile.response';
import { CuratedProfileQueryDto } from './dto/curated-profile.query';

const CONTENT_LANGUAGE_HEADER = {
  'Content-Language': { description: 'Locale servido', schema: { type: 'string' } },
};

@ApiTags('curated-profiles')
@Controller('curated-profiles')
export class CuratedProfileController {
  constructor(
    private readonly listCuratedProfiles: ListCuratedProfilesUseCase,
    private readonly resolveCuratedProfile: ResolveCuratedProfileUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Perfiles curados públicos',
    description: 'Listado para el menú de navegación (solo PUBLIC), agrupable por `roleType`.',
  })
  @ApiOkResponse({ type: [CuratedProfileSummaryResponse], headers: CONTENT_LANGUAGE_HEADER })
  async list(
    @Query() _query: LocaleQueryDto,
    @RequestLocale() locale: Locale,
  ): Promise<CuratedProfileSummaryOutput[]> {
    const result = await this.listCuratedProfiles.execute({ locale });
    return result.value;
  }

  @Get(':slug')
  @ApiOperation({
    summary: 'Perfil curado resuelto',
    description:
      'Experiencias y skills filtradas por intersección de tags con overrides, orden cronológico, tema resuelto y secciones. ' +
      'Perfiles PROTECTED requieren el token por header `X-Access-Token` o query `token`.',
  })
  @ApiParam({ name: 'slug', example: 'tech-lead-dotnet' })
  @ApiHeader({
    name: 'X-Access-Token',
    required: false,
    description: 'Token de acceso para perfiles PROTECTED (prioridad sobre `?token=`).',
  })
  @ApiOkResponse({ type: CuratedProfileResponse, headers: CONTENT_LANGUAGE_HEADER })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'PROTECTED sin token válido' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Slug inexistente o perfil PRIVATE' })
  async findBySlug(
    @Param('slug') slug: string,
    @Query() _query: CuratedProfileQueryDto,
    @RequestLocale() locale: Locale,
    @AccessToken() accessToken: string | undefined,
  ): Promise<CuratedProfileOutput> {
    const result = await this.resolveCuratedProfile.execute({ slug, locale, accessToken });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }
}

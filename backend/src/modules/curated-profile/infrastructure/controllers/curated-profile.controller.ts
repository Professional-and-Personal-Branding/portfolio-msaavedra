import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { APP_CONFIG, AppConfig } from '../../../../config/configuration';
import { Locale } from '../../../../shared/domain/i18n';
import { toHttpException } from '../../../../shared/infrastructure/http/domain-error.mapper';
import { ErrorResponseDto } from '../../../../shared/infrastructure/http/error-response.dto';
import { hashIp } from '../../../../shared/infrastructure/http/ip-hash';
import { extractAdminToken } from '../../../auth/infrastructure/security/extract-admin-token';
import { LocaleQueryDto } from '../../../../shared/infrastructure/http/locale-query.dto';
import { RequestLocale } from '../../../../shared/infrastructure/http/request-locale.decorator';
import {
  CuratedProfileOutput,
  CuratedProfileSummaryOutput,
} from '../../application/dto/curated-profile.output';
import { JsonResumeOutput } from '../../application/dto/json-resume.output';
import { ExportCuratedProfileResumeUseCase } from '../../application/use-cases/export-curated-profile-resume.use-case';
import { ListCuratedProfilesUseCase } from '../../application/use-cases/list-curated-profiles.use-case';
import {
  ResolveCuratedProfileUseCase,
  ViewContext,
} from '../../application/use-cases/resolve-curated-profile.use-case';
import { AccessToken } from './access-token.decorator';
import {
  CuratedProfileResponse,
  CuratedProfileSummaryResponse,
} from './docs/curated-profile.response';
import { CuratedProfileQueryDto } from './dto/curated-profile.query';
import { ResumeQueryDto } from './dto/resume.query';
import {
  cacheFor,
  JSON_RESUME_RESPONSE_SCHEMA,
  RESUME_RESPONSE_HEADERS,
  setResumeHeaders,
} from './resume-http';

const CONTENT_LANGUAGE_HEADER = {
  'Content-Language': { description: 'Locale servido', schema: { type: 'string' } },
};

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

@ApiTags('curated-profiles')
@Controller('curated-profiles')
export class CuratedProfileController {
  private readonly analyticsSalt: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly listCuratedProfiles: ListCuratedProfilesUseCase,
    private readonly resolveCuratedProfile: ResolveCuratedProfileUseCase,
    private readonly exportResume: ExportCuratedProfileResumeUseCase,
    config: ConfigService,
  ) {
    const appConfig = config.getOrThrow<AppConfig>(APP_CONFIG);
    this.analyticsSalt = appConfig.analyticsSalt;
    this.frontendUrl = appConfig.frontendUrl;
  }

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

  @Get(':slug/resume.json')
  @ApiOperation({
    summary: 'Exportar el perfil curado como JSON Resume v1.0.0',
    description:
      'El mismo perfil que `GET /curated-profiles/{slug}` (mismos filtros, overrides, orden y secciones) traducido a JSON Resume, en el idioma pedido (un archivo por idioma). ' +
      'Mismos códigos que el detalle: 404 para slug inexistente, PRIVATE o archivado; 401 para PROTECTED sin token válido (`X-Access-Token` o `token`). ' +
      'No registra visita ni atribuye `via`/`src`. Un slug anterior resuelve con `Content-Location` al canónico. ' +
      'Responde como descarga (`Content-Disposition: attachment`), `X-Robots-Tag: noindex` y `Cache-Control: no-cache` (PUBLIC) o `private, no-store` (PROTECTED).',
  })
  @ApiParam({ name: 'slug', example: 'tech-lead-dotnet' })
  @ApiHeader({
    name: 'X-Access-Token',
    required: false,
    description: 'Token de acceso para perfiles PROTECTED (prioridad sobre `?token=`).',
  })
  @ApiProduces('application/json')
  @ApiOkResponse({
    schema: JSON_RESUME_RESPONSE_SCHEMA,
    headers: {
      ...RESUME_RESPONSE_HEADERS,
      'Content-Location': {
        description: 'Solo si se pidió un slug anterior: ruta del slug canónico',
        schema: { type: 'string' },
      },
    },
  })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'PROTECTED sin token válido' })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Slug inexistente, perfil PRIVATE o archivado',
  })
  async resume(
    @Param('slug') slug: string,
    @Query() _query: ResumeQueryDto,
    @RequestLocale() locale: Locale,
    @AccessToken() accessToken: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JsonResumeOutput> {
    const result = await this.exportResume.execute({
      slug,
      locale,
      accessToken,
      baseUrl: this.frontendUrl,
    });
    if (!result.ok) throw toHttpException(result.error);
    const { document, slug: canonical, visibility } = result.value;
    setResumeHeaders(res, { slug: canonical, locale, cache: cacheFor(visibility) });
    if (canonical !== slug) {
      res.setHeader(
        'Content-Location',
        `/api/curated-profiles/${encodeURIComponent(canonical)}/resume.json`,
      );
    }
    return document;
  }

  @Get(':slug')
  @ApiOperation({
    summary: 'Perfil curado resuelto',
    description:
      'Experiencias y skills filtradas por intersección de tags con overrides, orden cronológico, tema resuelto y secciones. ' +
      'Perfiles PROTECTED requieren el token por header `X-Access-Token` o query `token`. Cada respuesta 200 registra una visita (analítica, IP solo como hash) con su tipo: propia si trae una sesión del panel válida, de bot según el User-Agent, o de una persona; solo estas últimas suman en `views`. ' +
      'Los parámetros opcionales `via` (enlace de seguimiento) y `src` (portal) solo atribuyen la visita: no cambian la respuesta. ' +
      'Un slug anterior (renombrado) también resuelve: el cuerpo trae el slug canónico y `Content-Location` su ruta. Un perfil archivado responde 404.',
  })
  @ApiParam({ name: 'slug', example: 'tech-lead-dotnet' })
  @ApiHeader({
    name: 'X-Access-Token',
    required: false,
    description: 'Token de acceso para perfiles PROTECTED (prioridad sobre `?token=`).',
  })
  @ApiOkResponse({
    type: CuratedProfileResponse,
    headers: {
      ...CONTENT_LANGUAGE_HEADER,
      'Content-Location': {
        description: 'Solo si se pidió un slug anterior: ruta del slug canónico',
        schema: { type: 'string' },
      },
    },
  })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'PROTECTED sin token válido' })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Slug inexistente, perfil PRIVATE o archivado',
  })
  async findBySlug(
    @Param('slug') slug: string,
    @Query() query: CuratedProfileQueryDto,
    @RequestLocale() locale: Locale,
    @AccessToken() accessToken: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CuratedProfileOutput> {
    const viewContext: ViewContext = {
      locale,
      referrer: firstHeader(req.headers.referer),
      userAgent: firstHeader(req.headers['user-agent']),
      ipHash: hashIp(req.ip, this.analyticsSalt),
      // Solo se extrae: la validación ocurre en segundo plano y esta ruta sigue siendo anónima.
      sessionToken: extractAdminToken(req) ?? undefined,
      // Atribución del link (change `add-share-links`): crudos, se resuelven en segundo plano.
      via: query.via,
      src: query.src,
    };
    const result = await this.resolveCuratedProfile.execute({
      slug,
      locale,
      accessToken,
      viewContext,
    });
    if (!result.ok) throw toHttpException(result.error);
    // Resuelto por un slug anterior: se informa el canónico para que el cliente
    // corrija la URL (spec `curated-profile-resolution`, decisión D5).
    if (result.value.slug !== slug) {
      res.setHeader(
        'Content-Location',
        `/api/curated-profiles/${encodeURIComponent(result.value.slug)}`,
      );
    }
    return result.value;
  }
}

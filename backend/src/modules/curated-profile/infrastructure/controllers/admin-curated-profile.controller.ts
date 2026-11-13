import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { APP_CONFIG, AppConfig } from '../../../../config/configuration';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Locale } from '../../../../shared/domain/i18n';
import { adminValidationPipe } from '../../../../shared/infrastructure/http/admin-validation.pipe';
import { toHttpException } from '../../../../shared/infrastructure/http/domain-error.mapper';
import { ErrorResponseDto } from '../../../../shared/infrastructure/http/error-response.dto';
import { LocaleQueryDto } from '../../../../shared/infrastructure/http/locale-query.dto';
import { RequestLocale } from '../../../../shared/infrastructure/http/request-locale.decorator';
import { JwtAuthGuard } from '../../../auth/infrastructure/security/jwt-auth.guard';
import { AdminCuratedProfileOutput } from '../../application/dto/curated-profile.admin-output';
import { JsonResumeOutput } from '../../application/dto/json-resume.output';
import { ExportCuratedProfileResumeForAdminUseCase } from '../../application/use-cases/export-curated-profile-resume.use-case';
import {
  CreateCuratedProfileUseCase,
  DeleteCuratedProfileUseCase,
  GetCuratedProfileAdminUseCase,
  ListAllCuratedProfilesUseCase,
  UpdateCuratedProfileUseCase,
} from '../../application/use-cases/admin/curated-profile-admin.use-cases';
import {
  ArchiveCuratedProfileUseCase,
  DuplicateCuratedProfileUseCase,
  UnarchiveCuratedProfileUseCase,
} from '../../application/use-cases/admin/curated-profile-lifecycle.use-cases';
import { CreateCuratedProfileFromJobPostingUseCase } from '../../application/use-cases/admin/create-curated-profile-from-job-posting.use-case';
import {
  PreviewCuratedProfileOutput,
  PreviewCuratedProfileUseCase,
} from '../../application/use-cases/admin/preview-curated-profile.use-case';
import { AdminCuratedProfileResponse } from './docs/admin-curated-profile.response';
import {
  JSON_RESUME_RESPONSE_SCHEMA,
  RESUME_RESPONSE_HEADERS,
  setResumeHeaders,
} from './resume-http';
import { PreviewCuratedProfileResponse } from './docs/preview-curated-profile.response';
import {
  CreateCuratedProfileDto,
  DuplicateCuratedProfileDto,
  PreviewCuratedProfileDto,
  toCuratedProfileChanges,
  toDraftCuratedProfileProps,
  toNewCuratedProfileProps,
  UpdateCuratedProfileDto,
} from './dto/curated-profile.dto';
import { CreateCuratedProfileFromJobPostingDto } from './dto/from-job-posting.dto';

@ApiTags('admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin Bearer válido' })
@UseGuards(JwtAuthGuard)
@UsePipes(adminValidationPipe)
@Controller('admin/curated-profiles')
export class AdminCuratedProfileController {
  constructor(
    private readonly listAll: ListAllCuratedProfilesUseCase,
    private readonly getOne: GetCuratedProfileAdminUseCase,
    private readonly createOne: CreateCuratedProfileUseCase,
    private readonly createFromPosting: CreateCuratedProfileFromJobPostingUseCase,
    private readonly updateOne: UpdateCuratedProfileUseCase,
    private readonly deleteOne: DeleteCuratedProfileUseCase,
    private readonly preview: PreviewCuratedProfileUseCase,
    private readonly duplicateOne: DuplicateCuratedProfileUseCase,
    private readonly archiveOne: ArchiveCuratedProfileUseCase,
    private readonly unarchiveOne: UnarchiveCuratedProfileUseCase,
    private readonly exportResume: ExportCuratedProfileResumeForAdminUseCase,
    private readonly config: ConfigService,
  ) {}

  @Post('preview')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Previsualizar un borrador (no persiste)',
    description:
      'Resuelve un perfil curado sin guardarlo, con el mismo pipeline que la ruta pública: ' +
      'misma selección por tags, mismo tema mergeado y mismas secciones; el cuerpo es el de la ruta pública ' +
      'más `missingTranslations` (campos bilingües vacíos en el idioma pedido). No registra visitas y no evalúa la visibilidad.',
  })
  @ApiOkResponse({ type: PreviewCuratedProfileResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async previewDraft(
    @Body() dto: PreviewCuratedProfileDto,
    @Query() _query: LocaleQueryDto,
    @RequestLocale() locale: Locale,
  ): Promise<PreviewCuratedProfileOutput> {
    const result = await this.preview.execute({ draft: toDraftCuratedProfileProps(dto), locale });
    return result.value;
  }

  @Post('from-job-posting')
  @ApiOperation({
    summary: 'Crear un borrador de perfil curado desde una vacante importada',
    description:
      'Crea el perfil con los `filterTags` elegidos, que deben existir en el vocabulario de tus datos ' +
      '(tags de experiencias y proyectos visibles y de las skills). Nace PRIVATE, no enumerado, sin ' +
      'token y con el encabezado vacío (hereda el del perfil base). La vacante no se modifica.',
  })
  @ApiCreatedResponse({ type: AdminCuratedProfileResponse })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description:
      'Tags vacíos, repetidos o fuera del vocabulario (el mensaje los nombra); slug inválido',
  })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'La vacante no existe' })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'Slug ocupado o sin sufijo libre' })
  async createFromJobPosting(
    @Body() dto: CreateCuratedProfileFromJobPostingDto,
  ): Promise<AdminCuratedProfileOutput> {
    const result = await this.createFromPosting.execute(dto);
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Get()
  @ApiOperation({ summary: 'Listar perfiles curados (cualquier visibilidad, datos crudos)' })
  @ApiOkResponse({ type: [AdminCuratedProfileResponse] })
  async list(): Promise<AdminCuratedProfileOutput[]> {
    return (await this.listAll.execute()).value;
  }

  @Get(':id/resume.json')
  @ApiOperation({
    summary: 'Exportar un perfil curado como JSON Resume v1.0.0',
    description:
      'Lo guardado del perfil, en el idioma pedido, con el mismo composer y el mismo mapper que la ruta pública ' +
      '(`GET /curated-profiles/{slug}/resume.json`) pero sin evaluar visibilidad ni archivado: el administrador ' +
      'exporta también perfiles PRIVATE, PROTECTED y archivados. No registra visita. `Cache-Control: private, no-store`.',
  })
  @ApiProduces('application/json')
  @ApiOkResponse({ schema: JSON_RESUME_RESPONSE_SCHEMA, headers: RESUME_RESPONSE_HEADERS })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async resume(
    @Param('id') id: string,
    @Query() _query: LocaleQueryDto,
    @RequestLocale() locale: Locale,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JsonResumeOutput> {
    const { frontendUrl } = this.config.getOrThrow<AppConfig>(APP_CONFIG);
    const result = await this.exportResume.execute({ id, locale, baseUrl: frontendUrl });
    if (!result.ok) throw toHttpException(result.error);
    setResumeHeaders(res, { slug: result.value.slug, locale, cache: 'private' });
    return result.value.document;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver perfil curado' })
  @ApiOkResponse({ type: AdminCuratedProfileResponse })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async find(@Param('id') id: string): Promise<AdminCuratedProfileOutput> {
    const result = await this.getOne.execute({ id });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Post()
  @ApiOperation({ summary: 'Crear perfil curado' })
  @ApiCreatedResponse({ type: AdminCuratedProfileResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'Slug ya existe' })
  async create(@Body() dto: CreateCuratedProfileDto): Promise<AdminCuratedProfileOutput> {
    const result = await this.createOne.execute(toNewCuratedProfileProps(dto));
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar perfil curado (parcial)' })
  @ApiOkResponse({ type: AdminCuratedProfileResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCuratedProfileDto,
  ): Promise<AdminCuratedProfileOutput> {
    const result = await this.updateOne.execute({ id, changes: toCuratedProfileChanges(dto) });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  // ─── Ciclo de vida (add-curated-profile-lifecycle) ─────────────────────────

  @Post(':id/duplicate')
  @ApiOperation({
    summary: 'Duplicar perfil curado',
    description:
      'Copia la configuración con un slug derivado (`-2`, `-3`, …). El duplicado nace PRIVATE y ' +
      'no enumerado, sin token, sin visitas y sin archivar. El cuerpo no lleva nada.',
  })
  @ApiCreatedResponse({ type: AdminCuratedProfileResponse })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'Sin slug libre hasta -50' })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'El cuerpo no acepta campos' })
  async duplicate(
    @Param('id') id: string,
    @Body() _body: DuplicateCuratedProfileDto,
  ): Promise<AdminCuratedProfileOutput> {
    const result = await this.duplicateOne.execute({ id });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Post(':id/archive')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Archivar perfil curado',
    description:
      'Deja de resolver (404) y de enumerarse; conserva sus visitas. Idempotente: archivar ' +
      'dos veces conserva la primera fecha.',
  })
  @ApiOkResponse({ type: AdminCuratedProfileResponse })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async archive(@Param('id') id: string): Promise<AdminCuratedProfileOutput> {
    const result = await this.archiveOne.execute({ id });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Post(':id/unarchive')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Desarchivar perfil curado',
    description: 'Vuelve a resolver según su visibilidad. Idempotente.',
  })
  @ApiOkResponse({ type: AdminCuratedProfileResponse })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async unarchive(@Param('id') id: string): Promise<AdminCuratedProfileOutput> {
    const result = await this.unarchiveOne.execute({ id });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Borrar perfil curado (y sus visitas)',
    description: 'Borra también su analítica. Para retirar un perfil conservándola, archivarlo.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async remove(@Param('id') id: string): Promise<void> {
    const result = await this.deleteOne.execute({ id });
    if (!result.ok) throw toHttpException(result.error);
  }
}

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
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
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
import { CuratedProfileOutput } from '../../application/dto/curated-profile.output';
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
import { PreviewCuratedProfileUseCase } from '../../application/use-cases/admin/preview-curated-profile.use-case';
import { AdminCuratedProfileResponse } from './docs/admin-curated-profile.response';
import { CuratedProfileResponse } from './docs/curated-profile.response';
import {
  CreateCuratedProfileDto,
  DuplicateCuratedProfileDto,
  PreviewCuratedProfileDto,
  toCuratedProfileChanges,
  toDraftCuratedProfileProps,
  toNewCuratedProfileProps,
  UpdateCuratedProfileDto,
} from './dto/curated-profile.dto';

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
    private readonly updateOne: UpdateCuratedProfileUseCase,
    private readonly deleteOne: DeleteCuratedProfileUseCase,
    private readonly preview: PreviewCuratedProfileUseCase,
    private readonly duplicateOne: DuplicateCuratedProfileUseCase,
    private readonly archiveOne: ArchiveCuratedProfileUseCase,
    private readonly unarchiveOne: UnarchiveCuratedProfileUseCase,
  ) {}

  @Post('preview')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Previsualizar un borrador (no persiste)',
    description:
      'Resuelve un perfil curado sin guardarlo, con el mismo pipeline que la ruta pública: ' +
      'misma selección por tags, mismo tema mergeado, mismas secciones y el mismo cuerpo de respuesta. ' +
      'No registra visitas y no evalúa la visibilidad.',
  })
  @ApiOkResponse({ type: CuratedProfileResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async previewDraft(
    @Body() dto: PreviewCuratedProfileDto,
    @Query() _query: LocaleQueryDto,
    @RequestLocale() locale: Locale,
  ): Promise<CuratedProfileOutput> {
    const result = await this.preview.execute({ draft: toDraftCuratedProfileProps(dto), locale });
    return result.value;
  }

  @Get()
  @ApiOperation({ summary: 'Listar perfiles curados (cualquier visibilidad, datos crudos)' })
  @ApiOkResponse({ type: [AdminCuratedProfileResponse] })
  async list(): Promise<AdminCuratedProfileOutput[]> {
    return (await this.listAll.execute()).value;
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

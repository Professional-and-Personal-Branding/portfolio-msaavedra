import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import { AdminProfileOutput } from '../../application/dto/profile.admin-output';
import { ProfileOutput } from '../../application/dto/profile.output';
import {
  GetProfileAdminUseCase,
  PreviewProfileUseCase,
  ReplaceProfileUseCase,
} from '../../application/use-cases/admin/profile-admin.use-cases';
import { AdminProfileResponse } from './docs/admin-profile.response';
import { ProfileResponse } from './docs/profile.response';
import { PreviewProfileDto, ReplaceProfileDto, toProfileContent } from './dto/profile.dto';

/** Perfil base (add-profile-content-admin, D1): un singleton, sin id en la ruta. */
@ApiTags('admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin Bearer válido' })
@UseGuards(JwtAuthGuard)
@UsePipes(adminValidationPipe)
@Controller('admin/profile')
export class AdminProfileController {
  constructor(
    private readonly getOne: GetProfileAdminUseCase,
    private readonly replace: ReplaceProfileUseCase,
    private readonly preview: PreviewProfileUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Ver el perfil base (datos bilingües crudos)' })
  @ApiOkResponse({ type: AdminProfileResponse })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'No hay perfil cargado' })
  async find(): Promise<AdminProfileOutput> {
    const result = await this.getOne.execute();
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Put()
  @ApiOperation({
    summary: 'Reemplazar el perfil base',
    description:
      'Reemplazo completo: lo opcional que no se manda queda vacío. Un campo desconocido es 400. ' +
      'Los idiomas no van acá: tienen su propia ruta (`/api/admin/languages`).',
  })
  @ApiOkResponse({ type: AdminProfileResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'No hay perfil cargado' })
  async update(@Body() dto: ReplaceProfileDto): Promise<AdminProfileOutput> {
    const result = await this.replace.execute(toProfileContent(dto));
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Post('preview')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Previsualizar el perfil base sin guardarlo',
    description:
      'Resuelve el borrador al idioma negociado con el mismo mapper que `GET /api/profile`, ' +
      'sobre los idiomas ya guardados. No escribe nada.',
  })
  @ApiOkResponse({ type: ProfileResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async previewDraft(
    @Body() dto: PreviewProfileDto,
    @Query() _query: LocaleQueryDto,
    @RequestLocale() locale: Locale,
  ): Promise<ProfileOutput> {
    const result = await this.preview.execute({ content: toProfileContent(dto), locale });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }
}

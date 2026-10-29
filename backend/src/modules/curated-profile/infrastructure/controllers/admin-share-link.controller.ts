import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { adminValidationPipe } from '../../../../shared/infrastructure/http/admin-validation.pipe';
import { toHttpException } from '../../../../shared/infrastructure/http/domain-error.mapper';
import { ErrorResponseDto } from '../../../../shared/infrastructure/http/error-response.dto';
import { JwtAuthGuard } from '../../../auth/infrastructure/security/jwt-auth.guard';
import { ShareLinkOutput } from '../../application/dto/share-link.output';
import {
  CreateShareLinkUseCase,
  GetOrCreateLinkedInShareLinkUseCase,
  ListShareLinksUseCase,
  RenameShareLinkUseCase,
  RevokeShareLinkUseCase,
} from '../../application/use-cases/admin/share-links.use-cases';
import { ShareLinkResponse } from './docs/share-link.response';
import { CreateShareLinkDto, UpdateShareLinkDto } from './dto/share-link.dto';

/**
 * Enlaces de seguimiento de un perfil (decisión D10 de `add-share-links`). Sin borrado: la
 * historia de atribución se conserva; los enlaces caen solo con su perfil. La ruta literal
 * `linkedin` se declara antes que `:linkId`.
 */
@ApiTags('admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin Bearer válido' })
@UseGuards(JwtAuthGuard)
@UsePipes(adminValidationPipe)
@ApiParam({ name: 'id', description: 'Id del perfil curado' })
@Controller('admin/curated-profiles/:id/share-links')
export class AdminShareLinkController {
  constructor(
    private readonly listLinks: ListShareLinksUseCase,
    private readonly createLink: CreateShareLinkUseCase,
    private readonly renameLink: RenameShareLinkUseCase,
    private readonly revokeLink: RevokeShareLinkUseCase,
    private readonly linkedInLink: GetOrCreateLinkedInShareLinkUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Enlaces de seguimiento del perfil',
    description:
      'Más recientes primero, con las aperturas de personas (`opens`, `lastOpenedAt`) de toda su historia.',
  })
  @ApiOkResponse({ type: [ShareLinkResponse] })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async list(@Param('id') id: string): Promise<ShareLinkOutput[]> {
    const result = await this.listLinks.execute({ profileId: id });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Post()
  @ApiOperation({
    summary: 'Crear un enlace de seguimiento',
    description:
      'Genera un código aleatorio de 10 caracteres. El código, el portal y el perfil no cambian después.',
  })
  @ApiCreatedResponse({ type: ShareLinkResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Etiqueta o portal inválidos' })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async create(@Param('id') id: string, @Body() dto: CreateShareLinkDto): Promise<ShareLinkOutput> {
    const result = await this.createLink.execute({
      profileId: id,
      label: dto.label,
      portal: dto.portal,
    });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Post('linkedin')
  @ApiOperation({
    summary: 'Enlace para «Compartir en LinkedIn»',
    description:
      'Devuelve el enlace `LINKEDIN_POST` activo más reciente del perfil (200) o crea uno con portal `linkedin` (201). Solo perfiles PUBLIC y no archivados.',
  })
  @ApiOkResponse({ type: ShareLinkResponse, description: 'Se reusó el enlace activo' })
  @ApiCreatedResponse({ type: ShareLinkResponse, description: 'Se creó un enlace nuevo' })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'El perfil no es PUBLIC o está archivado',
  })
  async linkedin(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ShareLinkOutput> {
    const result = await this.linkedInLink.execute({ profileId: id });
    if (!result.ok) throw toHttpException(result.error);
    res.status(result.value.created ? 201 : 200);
    return result.value.link;
  }

  @Patch(':linkId')
  @ApiOperation({ summary: 'Cambiar la etiqueta de un enlace' })
  @ApiParam({ name: 'linkId' })
  @ApiOkResponse({ type: ShareLinkResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'El enlace no existe o es de otro perfil',
  })
  async rename(
    @Param('id') id: string,
    @Param('linkId') linkId: string,
    @Body() dto: UpdateShareLinkDto,
  ): Promise<ShareLinkOutput> {
    const result = await this.renameLink.execute({ profileId: id, linkId, label: dto.label });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Post(':linkId/revoke')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Revocar un enlace',
    description:
      'Irreversible e idempotente: revocar uno revocado devuelve el mismo `revokedAt`. El link sigue abriendo el perfil; solo deja de atribuirse.',
  })
  @ApiParam({ name: 'linkId' })
  @ApiOkResponse({ type: ShareLinkResponse })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'El enlace no existe o es de otro perfil',
  })
  async revoke(@Param('id') id: string, @Param('linkId') linkId: string): Promise<ShareLinkOutput> {
    const result = await this.revokeLink.execute({ profileId: id, linkId });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }
}

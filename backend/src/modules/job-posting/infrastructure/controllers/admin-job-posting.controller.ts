import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { adminValidationPipe } from '../../../../shared/infrastructure/http/admin-validation.pipe';
import { toHttpException } from '../../../../shared/infrastructure/http/domain-error.mapper';
import { ErrorResponseDto } from '../../../../shared/infrastructure/http/error-response.dto';
import { JwtAuthGuard } from '../../../auth/infrastructure/security/jwt-auth.guard';
import {
  JobPostingOutput,
  JobPostingSuggestionOutput,
} from '../../application/dto/job-posting.output';
import { ImportJobPostingUseCase } from '../../application/use-cases/import-job-posting.use-case';
import {
  DeleteJobPostingUseCase,
  GetJobPostingUseCase,
  ListJobPostingsUseCase,
  SuggestProfileCriteriaFromPostingUseCase,
} from '../../application/use-cases/job-posting.use-cases';
import { JobPostingResponse, JobPostingSuggestionResponse } from './docs/job-posting.response';
import { ImportJobPostingDto } from './dto/job-posting.dto';

/** Importaciones por minuto y por IP (D15): cada una puede salir a la red. */
export const IMPORT_RATE_LIMIT = { limit: 10, ttl: 60_000 } as const;

/**
 * Vacantes del panel (change `add-job-posting-intake`). Todo bajo `/api/admin/`: no hay ninguna
 * ruta pública. Sin sesión, 401 antes de que salga ninguna petición.
 */
@ApiTags('admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin sesión de administrador' })
@UseGuards(JwtAuthGuard)
@UsePipes(adminValidationPipe)
@Controller('admin/job-postings')
export class AdminJobPostingController {
  constructor(
    private readonly importPosting: ImportJobPostingUseCase,
    private readonly listPostings: ListJobPostingsUseCase,
    private readonly getPosting: GetJobPostingUseCase,
    private readonly deletePosting: DeleteJobPostingUseCase,
    private readonly suggest: SuggestProfileCriteriaFromPostingUseCase,
  ) {}

  @Post()
  @Throttle({ default: IMPORT_RATE_LIMIT })
  @ApiOperation({
    summary: 'Importar una vacante desde una URL o desde texto',
    description:
      '`url` **o** `text`. Con URL: Greenhouse, Lever y Ashby por su API pública y, para cualquier ' +
      'otra página https pública, el bloque JSON-LD `JobPosting`. Los portales cerrados (LinkedIn, ' +
      'Indeed, Glassdoor…) responden 422 sin ninguna petición. La política de red rechaza http, IP ' +
      'literales, puertos, nombres locales y direcciones no públicas en cada redirect. Con texto: ' +
      'extracción determinística, sin red. Reimportar la misma vacante la actualiza (200); nueva, 201. ' +
      'Límite: 10 por minuto por IP.',
  })
  @ApiCreatedResponse({ type: JobPostingResponse, description: 'Vacante nueva' })
  @ApiOkResponse({ type: JobPostingResponse, description: 'Vacante ya importada, actualizada' })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: '`url` y `text` juntos o ninguno, texto fuera de 50 a 50 000, referencia no https',
  })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponseDto,
    description:
      'No se pudo leer la URL (portal cerrado, política de red, plazo, tamaño, tipo, sin vacante). ' +
      'El mensaje indica pegar el texto',
  })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto, description: 'Más de 10 por minuto' })
  async import(
    @Body() dto: ImportJobPostingDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JobPostingOutput> {
    const result = await this.importPosting.execute(dto);
    if (!result.ok) throw toHttpException(result.error);
    res.status(result.value.created ? 201 : 200);
    return result.value.posting;
  }

  @Get()
  @ApiOperation({
    summary: 'Listar vacantes importadas',
    description:
      'Por `importedAt` descendente. Antes de leer, borra el texto de las vacantes con más de 90 días.',
  })
  @ApiOkResponse({ type: [JobPostingResponse] })
  async list(): Promise<JobPostingOutput[]> {
    return (await this.listPostings.execute()).value;
  }

  @Get(':id/suggestion')
  @ApiOperation({
    summary: 'Sugerir criterios de un perfil curado desde la vacante',
    description:
      'Cobertura de los términos detectados contra el vocabulario **vigente** de tus datos ' +
      '(tags de experiencias y proyectos visibles y de las skills). Solo trae la cobertura, hasta ' +
      '8 tags sugeridos, un título y una base de slug. Se calcula en cada llamada.',
  })
  @ApiOkResponse({ type: JobPostingSuggestionResponse })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async suggestion(@Param('id') id: string): Promise<JobPostingSuggestionOutput> {
    const result = await this.suggest.execute({ id });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Leer una vacante importada' })
  @ApiOkResponse({ type: JobPostingResponse })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async get(@Param('id') id: string): Promise<JobPostingOutput> {
    const result = await this.getPosting.execute({ id });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Borrar una vacante importada',
    description: 'Los perfiles curados creados desde ella no cambian.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async remove(@Param('id') id: string): Promise<void> {
    const result = await this.deletePosting.execute({ id });
    if (!result.ok) throw toHttpException(result.error);
  }
}

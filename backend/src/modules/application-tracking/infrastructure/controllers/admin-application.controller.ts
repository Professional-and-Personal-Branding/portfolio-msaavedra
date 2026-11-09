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
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { adminValidationPipe } from '../../../../shared/infrastructure/http/admin-validation.pipe';
import { toHttpException } from '../../../../shared/infrastructure/http/domain-error.mapper';
import { ErrorResponseDto } from '../../../../shared/infrastructure/http/error-response.dto';
import { JwtAuthGuard } from '../../../auth/infrastructure/security/jwt-auth.guard';
import {
  ApplicationOutput,
  ApplicationSummaryOutput,
} from '../../application/dto/application.output';
import {
  CreateApplicationUseCase,
  DeleteApplicationUseCase,
  ExportApplicationsUseCase,
  GetApplicationSummaryUseCase,
  GetApplicationUseCase,
  ListApplicationsUseCase,
  UpdateApplicationUseCase,
} from '../../application/use-cases/application.use-cases';
import { ApplicationResponse, ApplicationSummaryResponse } from './docs/application.response';
import {
  CreateApplicationDto,
  ListApplicationsQuery,
  UpdateApplicationDto,
} from './dto/application.dto';

/**
 * Postulaciones del panel (CRM personal, D9 de `add-application-tracking`). Todo bajo
 * `/api/admin/`: no hay ninguna ruta pública. Las rutas literales `summary` y `export` se
 * declaran antes que `:id`.
 */
@ApiTags('admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin sesión de administrador' })
@UseGuards(JwtAuthGuard)
@UsePipes(adminValidationPipe)
@Controller('admin/applications')
export class AdminApplicationController {
  constructor(
    private readonly listApplications: ListApplicationsUseCase,
    private readonly getSummary: GetApplicationSummaryUseCase,
    private readonly exportApplications: ExportApplicationsUseCase,
    private readonly getApplication: GetApplicationUseCase,
    private readonly createApplication: CreateApplicationUseCase,
    private readonly updateApplication: UpdateApplicationUseCase,
    private readonly deleteApplication: DeleteApplicationUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar postulaciones',
    description:
      'Más recientemente editadas primero (`updatedAt` y `id` descendentes). `status` acepta uno o varios estados separados por coma; sin él, todas. Cada una trae las aperturas humanas de su enlace.',
  })
  @ApiOkResponse({ type: [ApplicationResponse] })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Estado desconocido' })
  async list(@Query() query: ListApplicationsQuery): Promise<ApplicationOutput[]> {
    return this.listApplications.execute({ statuses: query.status });
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Resumen por estado',
    description:
      'Los siete estados con ceros y `active` (DRAFT, APPLIED, INTERVIEWING y OFFER). Es el estado actual: no depende de un rango de fechas.',
  })
  @ApiOkResponse({ type: ApplicationSummaryResponse })
  async summary(): Promise<ApplicationSummaryOutput> {
    return this.getSummary.execute();
  }

  @Get('export')
  @ApiOperation({
    summary: 'Exportar a CSV',
    description:
      'Mismo filtro y orden que la lista. UTF-8 con BOM, coma, CRLF, todas las celdas entre comillas y las que empiezan con `=`, `+`, `-`, `@`, tabulación o retorno de carro con un apóstrofo delante (sin fórmulas ejecutables). `Cache-Control: no-store`.',
  })
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: 'Archivo CSV (`postulaciones-AAAA-MM-DD.csv`)',
    content: { 'text/csv': { schema: { type: 'string' } } },
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Estado desconocido' })
  async export(
    @Query() query: ListApplicationsQuery,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const { filename, csv } = await this.exportApplications.execute({ statuses: query.status });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    return csv;
  }

  @Post()
  @ApiOperation({
    summary: 'Crear una postulación',
    description: 'Se puede crear en cualquier estado. No admite datos de contacto de personas.',
  })
  @ApiCreatedResponse({ type: ApplicationResponse })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description:
      'Campo inválido, perfil o enlace inexistente, ajeno o `LINKEDIN_POST`, fecha inválida',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'El enlace ya está en otra postulación',
  })
  async create(@Body() dto: CreateApplicationDto): Promise<ApplicationOutput> {
    const result = await this.createApplication.execute(dto);
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Leer una postulación' })
  @ApiOkResponse({ type: ApplicationResponse })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async get(@Param('id') id: string): Promise<ApplicationOutput> {
    const result = await this.getApplication.execute({ id });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Editar una postulación',
    description:
      'Campos parciales, incluido `status`, en una sola escritura: si la transición es inválida, 422 y nada cambia.',
  })
  @ApiOkResponse({ type: ApplicationResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'El enlace ya está en otra postulación',
  })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponseDto,
    description: 'Transición de estado inválida (no se cambia nada)',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
  ): Promise<ApplicationOutput> {
    const result = await this.updateApplication.execute({ id, ...dto });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Borrar una postulación' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async remove(@Param('id') id: string): Promise<void> {
    const result = await this.deleteApplication.execute({ id });
    if (!result.ok) throw toHttpException(result.error);
  }
}

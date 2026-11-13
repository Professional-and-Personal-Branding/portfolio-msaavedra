import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
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
import { adminValidationPipe } from '../../../../shared/infrastructure/http/admin-validation.pipe';
import { toHttpException } from '../../../../shared/infrastructure/http/domain-error.mapper';
import { ErrorResponseDto } from '../../../../shared/infrastructure/http/error-response.dto';
import { JwtAuthGuard } from '../../../auth/infrastructure/security/jwt-auth.guard';
import { AdminFeaturedRepositoryOutput } from '../../application/dto/featured-repository.admin-output';
import {
  CreateFeaturedRepositoryUseCase,
  DeleteFeaturedRepositoryUseCase,
  GetFeaturedRepositoryAdminUseCase,
  ListAllFeaturedRepositoriesUseCase,
  UpdateFeaturedRepositoryUseCase,
} from '../../application/use-cases/admin/featured-repository-admin.use-cases';
import { AdminFeaturedRepositoryResponse } from './docs/admin-featured-repository.response';
import {
  CreateFeaturedRepositoryDto,
  toFeaturedRepositoryChanges,
  toNewFeaturedRepositoryProps,
  UpdateFeaturedRepositoryDto,
} from './dto/featured-repository.dto';

@ApiTags('admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin Bearer válido' })
@UseGuards(JwtAuthGuard)
@UsePipes(adminValidationPipe)
@Controller('admin/featured-repositories')
export class AdminFeaturedRepositoryController {
  constructor(
    private readonly listAll: ListAllFeaturedRepositoriesUseCase,
    private readonly getOne: GetFeaturedRepositoryAdminUseCase,
    private readonly createOne: CreateFeaturedRepositoryUseCase,
    private readonly updateOne: UpdateFeaturedRepositoryUseCase,
    private readonly deleteOne: DeleteFeaturedRepositoryUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar repositorios destacados (incluye ocultos, descripción bilingüe cruda)',
  })
  @ApiOkResponse({ type: [AdminFeaturedRepositoryResponse] })
  async list(): Promise<AdminFeaturedRepositoryOutput[]> {
    return (await this.listAll.execute()).value;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver repositorio destacado' })
  @ApiOkResponse({ type: AdminFeaturedRepositoryResponse })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async find(@Param('id') id: string): Promise<AdminFeaturedRepositoryOutput> {
    const result = await this.getOne.execute({ id });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Post()
  @ApiOperation({ summary: 'Crear repositorio destacado' })
  @ApiCreatedResponse({ type: AdminFeaturedRepositoryResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'El repositorio ya está cargado' })
  async create(@Body() dto: CreateFeaturedRepositoryDto): Promise<AdminFeaturedRepositoryOutput> {
    const result = await this.createOne.execute(toNewFeaturedRepositoryProps(dto));
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar repositorio destacado (parcial)' })
  @ApiOkResponse({ type: AdminFeaturedRepositoryResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'El repositorio ya está cargado' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFeaturedRepositoryDto,
  ): Promise<AdminFeaturedRepositoryOutput> {
    const result = await this.updateOne.execute({ id, changes: toFeaturedRepositoryChanges(dto) });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Borrar repositorio destacado' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async remove(@Param('id') id: string): Promise<void> {
    const result = await this.deleteOne.execute({ id });
    if (!result.ok) throw toHttpException(result.error);
  }
}

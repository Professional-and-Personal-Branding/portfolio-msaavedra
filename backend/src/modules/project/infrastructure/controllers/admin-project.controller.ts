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
import { AdminProjectOutput } from '../../application/dto/project.admin-output';
import {
  CreateProjectUseCase,
  DeleteProjectUseCase,
  GetProjectAdminUseCase,
  ListAllProjectsUseCase,
  UpdateProjectUseCase,
} from '../../application/use-cases/admin/project-admin.use-cases';
import { AdminProjectResponse } from './docs/admin-project.response';
import {
  CreateProjectDto,
  toNewProjectProps,
  toProjectChanges,
  UpdateProjectDto,
} from './dto/project.dto';

@ApiTags('admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin Bearer válido' })
@UseGuards(JwtAuthGuard)
@UsePipes(adminValidationPipe)
@Controller('admin/projects')
export class AdminProjectController {
  constructor(
    private readonly listAll: ListAllProjectsUseCase,
    private readonly getOne: GetProjectAdminUseCase,
    private readonly createOne: CreateProjectUseCase,
    private readonly updateOne: UpdateProjectUseCase,
    private readonly deleteOne: DeleteProjectUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar proyectos (incluye ocultos, datos bilingües crudos)' })
  @ApiOkResponse({ type: [AdminProjectResponse] })
  async list(): Promise<AdminProjectOutput[]> {
    return (await this.listAll.execute()).value;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver proyecto' })
  @ApiOkResponse({ type: AdminProjectResponse })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async find(@Param('id') id: string): Promise<AdminProjectOutput> {
    const result = await this.getOne.execute({ id });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Post()
  @ApiOperation({ summary: 'Crear proyecto' })
  @ApiCreatedResponse({ type: AdminProjectResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async create(@Body() dto: CreateProjectDto): Promise<AdminProjectOutput> {
    const result = await this.createOne.execute(toNewProjectProps(dto));
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar proyecto (parcial)' })
  @ApiOkResponse({ type: AdminProjectResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<AdminProjectOutput> {
    const result = await this.updateOne.execute({ id, changes: toProjectChanges(dto) });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Borrar proyecto' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async remove(@Param('id') id: string): Promise<void> {
    const result = await this.deleteOne.execute({ id });
    if (!result.ok) throw toHttpException(result.error);
  }
}

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
import { AdminExperienceOutput } from '../../application/dto/experience.admin-output';
import {
  CreateExperienceUseCase,
  DeleteExperienceUseCase,
  GetExperienceAdminUseCase,
  ListAllExperiencesUseCase,
  UpdateExperienceUseCase,
} from '../../application/use-cases/admin/experience-admin.use-cases';
import { AdminExperienceResponse } from './docs/admin-experience.response';
import {
  CreateExperienceDto,
  toExperienceChanges,
  toNewExperienceProps,
  UpdateExperienceDto,
} from './dto/create-experience.dto';

@ApiTags('admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin Bearer válido' })
@UseGuards(JwtAuthGuard)
@UsePipes(adminValidationPipe)
@Controller('admin/experiences')
export class AdminExperienceController {
  constructor(
    private readonly listAll: ListAllExperiencesUseCase,
    private readonly getOne: GetExperienceAdminUseCase,
    private readonly createOne: CreateExperienceUseCase,
    private readonly updateOne: UpdateExperienceUseCase,
    private readonly deleteOne: DeleteExperienceUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar experiencias (incluye ocultas, datos bilingües crudos)' })
  @ApiOkResponse({ type: [AdminExperienceResponse] })
  async list(): Promise<AdminExperienceOutput[]> {
    return (await this.listAll.execute()).value;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver experiencia' })
  @ApiOkResponse({ type: AdminExperienceResponse })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async find(@Param('id') id: string): Promise<AdminExperienceOutput> {
    const result = await this.getOne.execute({ id });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Post()
  @ApiOperation({ summary: 'Crear experiencia' })
  @ApiCreatedResponse({ type: AdminExperienceResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async create(@Body() dto: CreateExperienceDto): Promise<AdminExperienceOutput> {
    const result = await this.createOne.execute(toNewExperienceProps(dto));
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar experiencia (parcial)' })
  @ApiOkResponse({ type: AdminExperienceResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateExperienceDto,
  ): Promise<AdminExperienceOutput> {
    const result = await this.updateOne.execute({ id, changes: toExperienceChanges(dto) });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Borrar experiencia' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async remove(@Param('id') id: string): Promise<void> {
    const result = await this.deleteOne.execute({ id });
    if (!result.ok) throw toHttpException(result.error);
  }
}

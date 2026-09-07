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
import { AdminCuratedProfileOutput } from '../../application/dto/curated-profile.admin-output';
import {
  CreateCuratedProfileUseCase,
  DeleteCuratedProfileUseCase,
  GetCuratedProfileAdminUseCase,
  ListAllCuratedProfilesUseCase,
  UpdateCuratedProfileUseCase,
} from '../../application/use-cases/admin/curated-profile-admin.use-cases';
import { AdminCuratedProfileResponse } from './docs/admin-curated-profile.response';
import {
  CreateCuratedProfileDto,
  toCuratedProfileChanges,
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
  ) {}

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

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Borrar perfil curado (y sus visitas)' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async remove(@Param('id') id: string): Promise<void> {
    const result = await this.deleteOne.execute({ id });
    if (!result.ok) throw toHttpException(result.error);
  }
}

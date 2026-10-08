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
import { AdminLanguageOutput } from '../../application/dto/profile.admin-output';
import {
  CreateLanguageUseCase,
  DeleteLanguageUseCase,
  GetLanguageAdminUseCase,
  ListAllLanguagesUseCase,
  UpdateLanguageUseCase,
} from '../../application/use-cases/admin/language-admin.use-cases';
import { AdminLanguageResponse } from './docs/admin-profile.response';
import {
  CreateLanguageDto,
  toLanguageChanges,
  toNewLanguageProps,
  UpdateLanguageDto,
} from './dto/profile.dto';

/** Idiomas del perfil base: cuelgan del perfil, pero con API propia (D2). */
@ApiTags('admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin Bearer válido' })
@UseGuards(JwtAuthGuard)
@UsePipes(adminValidationPipe)
@Controller('admin/languages')
export class AdminLanguageController {
  constructor(
    private readonly listAll: ListAllLanguagesUseCase,
    private readonly getOne: GetLanguageAdminUseCase,
    private readonly createOne: CreateLanguageUseCase,
    private readonly updateOne: UpdateLanguageUseCase,
    private readonly deleteOne: DeleteLanguageUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar idiomas (datos bilingües crudos)' })
  @ApiOkResponse({ type: [AdminLanguageResponse] })
  async list(): Promise<AdminLanguageOutput[]> {
    return (await this.listAll.execute()).value;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver idioma' })
  @ApiOkResponse({ type: AdminLanguageResponse })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async find(@Param('id') id: string): Promise<AdminLanguageOutput> {
    const result = await this.getOne.execute({ id });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Post()
  @ApiOperation({ summary: 'Crear idioma (en el perfil base)' })
  @ApiCreatedResponse({ type: AdminLanguageResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'No hay perfil cargado' })
  async create(@Body() dto: CreateLanguageDto): Promise<AdminLanguageOutput> {
    const result = await this.createOne.execute(toNewLanguageProps(dto));
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar idioma (parcial)' })
  @ApiOkResponse({ type: AdminLanguageResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLanguageDto,
  ): Promise<AdminLanguageOutput> {
    const result = await this.updateOne.execute({ id, changes: toLanguageChanges(dto) });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Borrar idioma' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async remove(@Param('id') id: string): Promise<void> {
    const result = await this.deleteOne.execute({ id });
    if (!result.ok) throw toHttpException(result.error);
  }
}

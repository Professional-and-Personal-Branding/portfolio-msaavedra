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
import { AdminEducationOutput } from '../../application/dto/education.admin-output';
import {
  CreateEducationUseCase,
  DeleteEducationUseCase,
  GetEducationAdminUseCase,
  ListAllEducationUseCase,
  UpdateEducationUseCase,
} from '../../application/use-cases/admin/education-admin.use-cases';
import { AdminEducationResponse } from './docs/admin-education.response';
import {
  CreateEducationDto,
  toEducationChanges,
  toNewEducationProps,
  UpdateEducationDto,
} from './dto/education.dto';

@ApiTags('admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin Bearer válido' })
@UseGuards(JwtAuthGuard)
@UsePipes(adminValidationPipe)
@Controller('admin/education')
export class AdminEducationController {
  constructor(
    private readonly listAll: ListAllEducationUseCase,
    private readonly getOne: GetEducationAdminUseCase,
    private readonly createOne: CreateEducationUseCase,
    private readonly updateOne: UpdateEducationUseCase,
    private readonly deleteOne: DeleteEducationUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar formación (incluye oculta, datos bilingües crudos)' })
  @ApiOkResponse({ type: [AdminEducationResponse] })
  async list(): Promise<AdminEducationOutput[]> {
    return (await this.listAll.execute()).value;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver formación' })
  @ApiOkResponse({ type: AdminEducationResponse })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async find(@Param('id') id: string): Promise<AdminEducationOutput> {
    const result = await this.getOne.execute({ id });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Post()
  @ApiOperation({ summary: 'Crear formación' })
  @ApiCreatedResponse({ type: AdminEducationResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async create(@Body() dto: CreateEducationDto): Promise<AdminEducationOutput> {
    const result = await this.createOne.execute(toNewEducationProps(dto));
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar formación (parcial)' })
  @ApiOkResponse({ type: AdminEducationResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEducationDto,
  ): Promise<AdminEducationOutput> {
    const result = await this.updateOne.execute({ id, changes: toEducationChanges(dto) });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Borrar formación' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async remove(@Param('id') id: string): Promise<void> {
    const result = await this.deleteOne.execute({ id });
    if (!result.ok) throw toHttpException(result.error);
  }
}

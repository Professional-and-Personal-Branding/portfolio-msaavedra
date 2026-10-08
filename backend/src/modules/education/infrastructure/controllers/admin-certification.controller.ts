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
import { AdminCertificationOutput } from '../../application/dto/education.admin-output';
import {
  CreateCertificationUseCase,
  DeleteCertificationUseCase,
  GetCertificationAdminUseCase,
  ListAllCertificationsUseCase,
  UpdateCertificationUseCase,
} from '../../application/use-cases/admin/education-admin.use-cases';
import { AdminCertificationResponse } from './docs/admin-education.response';
import {
  CreateCertificationDto,
  toCertificationChanges,
  toNewCertificationProps,
  UpdateCertificationDto,
} from './dto/certification.dto';

@ApiTags('admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin Bearer válido' })
@UseGuards(JwtAuthGuard)
@UsePipes(adminValidationPipe)
@Controller('admin/certifications')
export class AdminCertificationController {
  constructor(
    private readonly listAll: ListAllCertificationsUseCase,
    private readonly getOne: GetCertificationAdminUseCase,
    private readonly createOne: CreateCertificationUseCase,
    private readonly updateOne: UpdateCertificationUseCase,
    private readonly deleteOne: DeleteCertificationUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar certificaciones (incluye ocultas, datos bilingües crudos)' })
  @ApiOkResponse({ type: [AdminCertificationResponse] })
  async list(): Promise<AdminCertificationOutput[]> {
    return (await this.listAll.execute()).value;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver certificación' })
  @ApiOkResponse({ type: AdminCertificationResponse })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async find(@Param('id') id: string): Promise<AdminCertificationOutput> {
    const result = await this.getOne.execute({ id });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Post()
  @ApiOperation({ summary: 'Crear certificación' })
  @ApiCreatedResponse({ type: AdminCertificationResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async create(@Body() dto: CreateCertificationDto): Promise<AdminCertificationOutput> {
    const result = await this.createOne.execute(toNewCertificationProps(dto));
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar certificación (parcial)' })
  @ApiOkResponse({ type: AdminCertificationResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCertificationDto,
  ): Promise<AdminCertificationOutput> {
    const result = await this.updateOne.execute({ id, changes: toCertificationChanges(dto) });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Borrar certificación' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async remove(@Param('id') id: string): Promise<void> {
    const result = await this.deleteOne.execute({ id });
    if (!result.ok) throw toHttpException(result.error);
  }
}

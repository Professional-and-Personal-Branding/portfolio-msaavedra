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
import { AdminSocialLinkOutput } from '../../application/dto/social-link.admin-output';
import {
  CreateSocialLinkUseCase,
  DeleteSocialLinkUseCase,
  GetSocialLinkAdminUseCase,
  ListAllSocialLinksUseCase,
  UpdateSocialLinkUseCase,
} from '../../application/use-cases/admin/social-link-admin.use-cases';
import { AdminSocialLinkResponse } from './docs/admin-social-link.response';
import {
  CreateSocialLinkDto,
  toNewSocialLinkProps,
  toSocialLinkChanges,
  UpdateSocialLinkDto,
} from './dto/social-link.dto';

@ApiTags('admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin Bearer válido' })
@UseGuards(JwtAuthGuard)
@UsePipes(adminValidationPipe)
@Controller('admin/social-links')
export class AdminSocialLinkController {
  constructor(
    private readonly listAll: ListAllSocialLinksUseCase,
    private readonly getOne: GetSocialLinkAdminUseCase,
    private readonly createOne: CreateSocialLinkUseCase,
    private readonly updateOne: UpdateSocialLinkUseCase,
    private readonly deleteOne: DeleteSocialLinkUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar enlaces sociales (incluye ocultos, datos bilingües crudos)' })
  @ApiOkResponse({ type: [AdminSocialLinkResponse] })
  async list(): Promise<AdminSocialLinkOutput[]> {
    return (await this.listAll.execute()).value;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver enlace social' })
  @ApiOkResponse({ type: AdminSocialLinkResponse })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async find(@Param('id') id: string): Promise<AdminSocialLinkOutput> {
    const result = await this.getOne.execute({ id });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Post()
  @ApiOperation({ summary: 'Crear enlace social' })
  @ApiCreatedResponse({ type: AdminSocialLinkResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async create(@Body() dto: CreateSocialLinkDto): Promise<AdminSocialLinkOutput> {
    const result = await this.createOne.execute(toNewSocialLinkProps(dto));
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar enlace social (parcial)' })
  @ApiOkResponse({ type: AdminSocialLinkResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSocialLinkDto,
  ): Promise<AdminSocialLinkOutput> {
    const result = await this.updateOne.execute({ id, changes: toSocialLinkChanges(dto) });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Borrar enlace social' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async remove(@Param('id') id: string): Promise<void> {
    const result = await this.deleteOne.execute({ id });
    if (!result.ok) throw toHttpException(result.error);
  }
}

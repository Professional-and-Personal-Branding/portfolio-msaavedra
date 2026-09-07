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
import {
  AdminSkillCategoryOutput,
  AdminSkillOutput,
} from '../../application/dto/skill.admin-output';
import {
  CreateSkillCategoryUseCase,
  CreateSkillUseCase,
  DeleteSkillCategoryUseCase,
  DeleteSkillUseCase,
  ListSkillCategoriesAdminUseCase,
  UpdateSkillCategoryUseCase,
  UpdateSkillUseCase,
} from '../../application/use-cases/admin/skill-admin.use-cases';
import { AdminSkillCategoryResponse, AdminSkillResponse } from './docs/admin-skill.response';
import {
  CreateSkillCategoryDto,
  CreateSkillDto,
  toNewSkillCategoryProps,
  toNewSkillProps,
  toSkillCategoryChanges,
  toSkillChanges,
  UpdateSkillCategoryDto,
  UpdateSkillDto,
} from './dto/skill.dto';

@ApiTags('admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin Bearer válido' })
@UseGuards(JwtAuthGuard)
@UsePipes(adminValidationPipe)
@Controller('admin')
export class AdminSkillController {
  constructor(
    private readonly listCategories: ListSkillCategoriesAdminUseCase,
    private readonly createCategory: CreateSkillCategoryUseCase,
    private readonly updateCategory: UpdateSkillCategoryUseCase,
    private readonly deleteCategory: DeleteSkillCategoryUseCase,
    private readonly createSkill: CreateSkillUseCase,
    private readonly updateSkill: UpdateSkillUseCase,
    private readonly deleteSkill: DeleteSkillUseCase,
  ) {}

  @Get('skill-categories')
  @ApiOperation({ summary: 'Listar categorías con sus skills (datos crudos)' })
  @ApiOkResponse({ type: [AdminSkillCategoryResponse] })
  async list(): Promise<AdminSkillCategoryOutput[]> {
    return (await this.listCategories.execute()).value;
  }

  @Post('skill-categories')
  @ApiOperation({ summary: 'Crear categoría' })
  @ApiCreatedResponse({ type: AdminSkillCategoryResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async create(@Body() dto: CreateSkillCategoryDto): Promise<AdminSkillCategoryOutput> {
    return (await this.createCategory.execute(toNewSkillCategoryProps(dto))).value;
  }

  @Patch('skill-categories/:id')
  @ApiOperation({ summary: 'Editar categoría (parcial)' })
  @ApiOkResponse({ type: AdminSkillCategoryResponse })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSkillCategoryDto,
  ): Promise<AdminSkillCategoryOutput> {
    const result = await this.updateCategory.execute({ id, changes: toSkillCategoryChanges(dto) });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Delete('skill-categories/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Borrar categoría y sus skills' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async remove(@Param('id') id: string): Promise<void> {
    const result = await this.deleteCategory.execute({ id });
    if (!result.ok) throw toHttpException(result.error);
  }

  @Post('skill-categories/:categoryId/skills')
  @ApiOperation({ summary: 'Crear skill en una categoría' })
  @ApiCreatedResponse({ type: AdminSkillResponse })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Categoría inexistente' })
  async addSkill(
    @Param('categoryId') categoryId: string,
    @Body() dto: CreateSkillDto,
  ): Promise<AdminSkillOutput> {
    const result = await this.createSkill.execute({ categoryId, props: toNewSkillProps(dto) });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Patch('skills/:id')
  @ApiOperation({ summary: 'Editar skill (nombre, tags, orden, categoría)' })
  @ApiOkResponse({ type: AdminSkillResponse })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async editSkill(@Param('id') id: string, @Body() dto: UpdateSkillDto): Promise<AdminSkillOutput> {
    const result = await this.updateSkill.execute({ id, changes: toSkillChanges(dto) });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Delete('skills/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Borrar skill' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async removeSkill(@Param('id') id: string): Promise<void> {
    const result = await this.deleteSkill.execute({ id });
    if (!result.ok) throw toHttpException(result.error);
  }
}

import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../../../shared/infrastructure/http/error-response.dto';
import { JwtAuthGuard } from '../../../auth/infrastructure/security/jwt-auth.guard';
import { ThemeOutput } from '../../application/dto/theme.output';
import { ListThemesUseCase } from '../../application/use-cases/list-themes.use-case';
import { ThemeResponse } from './docs/theme.response';

@ApiTags('admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin sesión válida' })
@UseGuards(JwtAuthGuard)
@Controller('admin/themes')
export class AdminThemeController {
  constructor(private readonly listThemes: ListThemesUseCase) {}

  @Get()
  @ApiOperation({
    summary: 'Listar temas disponibles',
    description:
      'Catálogo para el customizador: los `id` son los que acepta `themeId` en el CRUD de perfiles curados y en el preview.',
  })
  @ApiOkResponse({ type: [ThemeResponse] })
  async list(): Promise<ThemeOutput[]> {
    return (await this.listThemes.execute()).value;
  }
}

import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Locale } from '../../../../shared/domain/i18n';
import { toHttpException } from '../../../../shared/infrastructure/http/domain-error.mapper';
import { ErrorResponseDto } from '../../../../shared/infrastructure/http/error-response.dto';
import { LocaleQueryDto } from '../../../../shared/infrastructure/http/locale-query.dto';
import { RequestLocale } from '../../../../shared/infrastructure/http/request-locale.decorator';
import { ExperienceOutput } from '../../application/dto/experience.output';
import { GetExperienceByIdUseCase } from '../../application/use-cases/get-experience-by-id.use-case';
import { ListExperiencesUseCase } from '../../application/use-cases/list-experiences.use-case';
import { ExperienceResponse } from './docs/experience.response';

const CONTENT_LANGUAGE_HEADER = {
  'Content-Language': { description: 'Locale servido', schema: { type: 'string' } },
};

@ApiTags('experiences')
@Controller('experiences')
export class ExperienceController {
  constructor(
    private readonly listExperiences: ListExperiencesUseCase,
    private readonly getExperienceById: GetExperienceByIdUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Experiencias laborales visibles',
    description:
      'Ordenadas por `order` ascendente y `startDate` descendente. Campos traducibles resueltos al locale negociado.',
  })
  @ApiOkResponse({ type: [ExperienceResponse], headers: CONTENT_LANGUAGE_HEADER })
  async list(
    @Query() _query: LocaleQueryDto,
    @RequestLocale() locale: Locale,
  ): Promise<ExperienceOutput[]> {
    const result = await this.listExperiences.execute({ locale });
    return result.value;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una experiencia visible' })
  @ApiParam({ name: 'id', description: 'Id de la experiencia' })
  @ApiOkResponse({ type: ExperienceResponse, headers: CONTENT_LANGUAGE_HEADER })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'No existe o no es visible' })
  async findById(
    @Param('id') id: string,
    @Query() _query: LocaleQueryDto,
    @RequestLocale() locale: Locale,
  ): Promise<ExperienceOutput> {
    const result = await this.getExperienceById.execute({ id, locale });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }
}

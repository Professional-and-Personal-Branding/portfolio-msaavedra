import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Locale } from '../../../../shared/domain/i18n';
import { LocaleQueryDto } from '../../../../shared/infrastructure/http/locale-query.dto';
import { RequestLocale } from '../../../../shared/infrastructure/http/request-locale.decorator';
import { ProjectOutput } from '../../application/dto/project.output';
import { ListProjectsUseCase } from '../../application/use-cases/list-projects.use-case';
import { ProjectResponse } from './docs/project.response';

@ApiTags('sections')
@Controller('projects')
export class ProjectController {
  constructor(private readonly listProjects: ListProjectsUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Proyectos destacados visibles' })
  @ApiOkResponse({
    type: [ProjectResponse],
    headers: { 'Content-Language': { description: 'Locale servido', schema: { type: 'string' } } },
  })
  async list(
    @Query() _query: LocaleQueryDto,
    @RequestLocale() locale: Locale,
  ): Promise<ProjectOutput[]> {
    return (await this.listProjects.execute({ locale })).value;
  }
}

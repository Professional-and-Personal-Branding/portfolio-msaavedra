import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Locale } from '../../../../shared/domain/i18n';
import { LocaleQueryDto } from '../../../../shared/infrastructure/http/locale-query.dto';
import { RequestLocale } from '../../../../shared/infrastructure/http/request-locale.decorator';
import { FeaturedRepositoryOutput } from '../../application/dto/featured-repository.output';
import { ListFeaturedRepositoriesUseCase } from '../../application/use-cases/list-featured-repositories.use-case';
import { FeaturedRepositoryResponse } from './docs/featured-repository.response';

@ApiTags('sections')
@Controller('featured-repositories')
export class FeaturedRepositoryController {
  constructor(private readonly listRepositories: ListFeaturedRepositoriesUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Repositorios destacados visibles' })
  @ApiOkResponse({
    type: [FeaturedRepositoryResponse],
    headers: { 'Content-Language': { description: 'Locale servido', schema: { type: 'string' } } },
  })
  async list(
    @Query() _query: LocaleQueryDto,
    @RequestLocale() locale: Locale,
  ): Promise<FeaturedRepositoryOutput[]> {
    return (await this.listRepositories.execute({ locale })).value;
  }
}

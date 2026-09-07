import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Locale } from '../../../../shared/domain/i18n';
import { LocaleQueryDto } from '../../../../shared/infrastructure/http/locale-query.dto';
import { RequestLocale } from '../../../../shared/infrastructure/http/request-locale.decorator';
import { SocialLinkOutput } from '../../application/dto/social-link.output';
import { ListSocialLinksUseCase } from '../../application/use-cases/list-social-links.use-case';
import { SocialLinkResponse } from './docs/social-link.response';

@ApiTags('sections')
@Controller('social-links')
export class SocialLinkController {
  constructor(private readonly listSocialLinks: ListSocialLinksUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Presencia pública (GitHub, LinkedIn, YouTube…) visible' })
  @ApiOkResponse({
    type: [SocialLinkResponse],
    headers: { 'Content-Language': { description: 'Locale servido', schema: { type: 'string' } } },
  })
  async list(
    @Query() _query: LocaleQueryDto,
    @RequestLocale() locale: Locale,
  ): Promise<SocialLinkOutput[]> {
    return (await this.listSocialLinks.execute({ locale })).value;
  }
}

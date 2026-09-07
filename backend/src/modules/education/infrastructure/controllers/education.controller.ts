import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Locale } from '../../../../shared/domain/i18n';
import { LocaleQueryDto } from '../../../../shared/infrastructure/http/locale-query.dto';
import { RequestLocale } from '../../../../shared/infrastructure/http/request-locale.decorator';
import { CertificationOutput, EducationOutput } from '../../application/dto/education.output';
import {
  ListCertificationsUseCase,
  ListEducationUseCase,
} from '../../application/use-cases/education.use-cases';
import { CertificationResponse, EducationResponse } from './docs/education.response';

const CONTENT_LANGUAGE_HEADER = {
  'Content-Language': { description: 'Locale servido', schema: { type: 'string' } },
};

@ApiTags('sections')
@Controller()
export class EducationController {
  constructor(
    private readonly listEducation: ListEducationUseCase,
    private readonly listCertifications: ListCertificationsUseCase,
  ) {}

  @Get('education')
  @ApiOperation({ summary: 'Formación académica visible' })
  @ApiOkResponse({ type: [EducationResponse], headers: CONTENT_LANGUAGE_HEADER })
  async education(
    @Query() _query: LocaleQueryDto,
    @RequestLocale() locale: Locale,
  ): Promise<EducationOutput[]> {
    return (await this.listEducation.execute({ locale })).value;
  }

  @Get('certifications')
  @ApiOperation({ summary: 'Certificaciones visibles' })
  @ApiOkResponse({ type: [CertificationResponse], headers: CONTENT_LANGUAGE_HEADER })
  async certifications(
    @Query() _query: LocaleQueryDto,
    @RequestLocale() locale: Locale,
  ): Promise<CertificationOutput[]> {
    return (await this.listCertifications.execute({ locale })).value;
  }
}

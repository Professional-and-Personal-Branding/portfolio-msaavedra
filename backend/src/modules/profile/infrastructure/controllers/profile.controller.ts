import { Controller, Get, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Locale } from '../../../../shared/domain/i18n';
import { toHttpException } from '../../../../shared/infrastructure/http/domain-error.mapper';
import { ErrorResponseDto } from '../../../../shared/infrastructure/http/error-response.dto';
import { LocaleQueryDto } from '../../../../shared/infrastructure/http/locale-query.dto';
import { RequestLocale } from '../../../../shared/infrastructure/http/request-locale.decorator';
import { ProfileOutput } from '../../application/dto/profile.output';
import { GetProfileUseCase } from '../../application/use-cases/get-profile.use-case';
import { ProfileResponse } from './docs/profile.response';

@ApiTags('profile')
@Controller('profile')
export class ProfileController {
  constructor(private readonly getProfile: GetProfileUseCase) {}

  @Get()
  @ApiOperation({
    summary: 'Perfil profesional base',
    description: 'Campos traducibles resueltos al locale negociado.',
  })
  @ApiOkResponse({
    type: ProfileResponse,
    headers: { 'Content-Language': { description: 'Locale servido', schema: { type: 'string' } } },
  })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'No hay perfil cargado' })
  async find(
    @Query() _query: LocaleQueryDto,
    @RequestLocale() locale: Locale,
  ): Promise<ProfileOutput> {
    const result = await this.getProfile.execute({ locale });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }
}

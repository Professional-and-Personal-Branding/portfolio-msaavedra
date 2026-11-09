import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Locale } from '../../../../shared/domain/i18n';
import { ErrorResponseDto } from '../../../../shared/infrastructure/http/error-response.dto';
import { LocaleQueryDto } from '../../../../shared/infrastructure/http/locale-query.dto';
import { RequestLocale } from '../../../../shared/infrastructure/http/request-locale.decorator';
import { JwtAuthGuard } from '../../../auth/infrastructure/security/jwt-auth.guard';
import { CvConsistencyReport } from '../../application/cv-consistency.output';
import { RunCvConsistencyCheckUseCase } from '../../application/use-cases/run-cv-consistency-check.use-case';
import { CvConsistencyResponse } from './docs/cv-consistency.response';

/**
 * Revisión de consistencia del CV (decisión D10 de `add-cv-consistency-rules`). Es una lectura:
 * no hay estado ni efectos, y nunca corrige nada. `no-store` para que el resultado siempre
 * refleje la última edición.
 */
@ApiTags('admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin sesión de administrador' })
@UseGuards(JwtAuthGuard)
@Controller('admin/consistency')
export class AdminCvConsistencyController {
  constructor(private readonly runCheck: RunCvConsistencyCheckUseCase) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Revisar la consistencia del CV',
    description:
      'Corre las reglas de consistencia sobre todo el contenido (ocho consultas fijas, sin escrituras) ' +
      'y devuelve los hallazgos con el mensaje y la etiqueta resueltos en el idioma pedido. ' +
      '`error`: la API del panel lo rechazaría o rompe el render; `warning`: probable descuido; ' +
      '`info`: suele ser legítimo. Los mismos hallazgos salen de `npm run cv:lint` sobre el archivo del seed.',
  })
  @ApiOkResponse({ type: CvConsistencyResponse })
  async run(
    @Query() _query: LocaleQueryDto,
    @RequestLocale() locale: Locale,
  ): Promise<CvConsistencyReport> {
    return (await this.runCheck.execute({ locale })).value;
  }
}

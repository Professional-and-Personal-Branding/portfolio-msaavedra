import { Controller, Get, Header, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { APP_CONFIG, AppConfig } from '../../../../config/configuration';
import { Locale } from '../../../../shared/domain/i18n';
import { RequestLocale } from '../../../../shared/infrastructure/http/request-locale.decorator';
import { GetProfileHeadUseCase } from '../../application/use-cases/get-profile-head.use-case';
import { ProfileHeadQueryDto } from './dto/profile-head.query';

/**
 * Fragmento de `<head>` que el borde (Caddy, `templates` + `httpInclude`) inserta
 * en el HTML inicial de cada perfil (spec `public-seo`). Devuelve HTML, no JSON,
 * y siempre 200: es presentación consumida por el borde. Exenta del límite de
 * peticiones como el healthcheck, porque la pide el sitio en cada carga de HTML.
 */
@ApiTags('seo')
@SkipThrottle()
@Controller('public')
export class ProfileHeadController {
  constructor(
    private readonly getProfileHead: GetProfileHeadUseCase,
    private readonly config: ConfigService,
  ) {}

  @Get('profile-head')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({
    summary: 'Fragmento de head por perfil (HTML)',
    description:
      'Metadatos del perfil para el HTML inicial: title, description, canonical, Open Graph, ' +
      'Twitter Card, robots y JSON-LD. Siempre 200. Un perfil PROTECTED, PRIVATE o inexistente ' +
      'devuelve el fragmento genérico con `noindex, nofollow`. No acepta token ni registra visitas.',
  })
  @ApiProduces('text/html')
  @ApiOkResponse({ description: 'Fragmento HTML para insertar dentro de <head>', type: String })
  async head(
    @Query() query: ProfileHeadQueryDto,
    @RequestLocale() locale: Locale,
  ): Promise<string> {
    const { frontendUrl } = this.config.getOrThrow<AppConfig>(APP_CONFIG);
    const result = await this.getProfileHead.execute({
      slug: query.slug ?? '',
      locale,
      baseUrl: frontendUrl,
    });
    return result.value;
  }
}
